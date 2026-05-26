// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ResourceMarketplace {
    enum ResourceType {
        GPU_HOUR,
        KWH
    }

    enum Side {
        BUY,
        SELL
    }

    struct Order {
        address maker;
        ResourceType resourceType;
        Side side;
        bytes32 nodeIdHash;
        uint256 unitPrice; // paymentToken decimals (mUSDC: 6)
        uint256 quantity; // resource units (integer for demo)
        uint256 filled;
        uint64 expiry; // unix seconds (0 = never)
        bool active;
    }

    event OrderCreated(
        uint256 indexed orderId,
        address indexed maker,
        ResourceType resourceType,
        Side side,
        bytes32 indexed nodeIdHash,
        uint256 unitPrice,
        uint256 quantity,
        uint64 expiry
    );

    event OrderCancelled(uint256 indexed orderId, address indexed maker);
    event OrderFilled(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 amount, uint256 totalPaid);

    IERC20 public immutable paymentToken;
    uint256 public nextOrderId;

    mapping(uint256 => Order) public orders;

    uint256[] private _openOrderIds;
    mapping(uint256 => uint256) private _openIndex; // orderId => index+1

    constructor(IERC20 _paymentToken) {
        paymentToken = _paymentToken;
        nextOrderId = 1;
    }

    function getOpenOrderIds() external view returns (uint256[] memory) {
        return _openOrderIds;
    }

    function createOrder(
        ResourceType resourceType,
        Side side,
        bytes32 nodeIdHash,
        uint256 unitPrice,
        uint256 quantity,
        uint64 expiry
    ) external returns (uint256 orderId) {
        require(unitPrice > 0, "unitPrice=0");
        require(quantity > 0, "quantity=0");
        if (expiry != 0) require(expiry > block.timestamp, "expiry<=now");

        orderId = nextOrderId++;
        orders[orderId] = Order({
            maker: msg.sender,
            resourceType: resourceType,
            side: side,
            nodeIdHash: nodeIdHash,
            unitPrice: unitPrice,
            quantity: quantity,
            filled: 0,
            expiry: expiry,
            active: true
        });

        _openIndex[orderId] = _openOrderIds.length + 1;
        _openOrderIds.push(orderId);

        emit OrderCreated(orderId, msg.sender, resourceType, side, nodeIdHash, unitPrice, quantity, expiry);
    }

    function cancelOrder(uint256 orderId) external {
        Order storage o = orders[orderId];
        require(o.active, "inactive");
        require(o.maker == msg.sender, "not maker");
        o.active = false;
        _removeOpen(orderId);
        emit OrderCancelled(orderId, msg.sender);
    }

    function fillOrder(uint256 orderId, uint256 amount) external {
        Order storage o = orders[orderId];
        require(o.active, "inactive");
        if (o.expiry != 0) require(o.expiry > block.timestamp, "expired");
        require(amount > 0, "amount=0");

        uint256 remaining = o.quantity - o.filled;
        require(amount <= remaining, "too much");

        address buyer = (o.side == Side.BUY) ? o.maker : msg.sender;
        address seller = (o.side == Side.BUY) ? msg.sender : o.maker;

        uint256 total = amount * o.unitPrice;
        require(paymentToken.transferFrom(buyer, seller, total), "transfer failed");

        o.filled += amount;
        if (o.filled == o.quantity) {
            o.active = false;
            _removeOpen(orderId);
        }

        emit OrderFilled(orderId, buyer, seller, amount, total);
    }

    function _removeOpen(uint256 orderId) internal {
        uint256 idxPlus1 = _openIndex[orderId];
        if (idxPlus1 == 0) return;
        uint256 idx = idxPlus1 - 1;
        uint256 lastId = _openOrderIds[_openOrderIds.length - 1];
        if (idx != _openOrderIds.length - 1) {
            _openOrderIds[idx] = lastId;
            _openIndex[lastId] = idx + 1;
        }
        _openOrderIds.pop();
        delete _openIndex[orderId];
    }
}

