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
        string allocationNodeId;
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
        string allocationNodeId,
        uint256 unitPrice,
        uint256 quantity,
        uint64 expiry
    );

    event OrderCancelled(uint256 indexed orderId, address indexed maker);
    event OrderFilled(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 amount, uint256 totalPaid);

    /// @notice Emitted when a buyer collects physical/digital rights after fill (compute SSH key or energy migration bundle).
    event ResourceCollected(
        bytes32 indexed orderId,
        address indexed buyer,
        string accessKey,
        string allocationNodeId
    );

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
        string calldata allocationNodeId,
        uint256 unitPrice,
        uint256 quantity,
        uint64 expiry
    ) external returns (uint256 orderId) {
        require(unitPrice > 0, "unitPrice=0");
        require(quantity > 0, "quantity=0");
        require(bytes(allocationNodeId).length > 0, "allocationNodeId=empty");
        if (expiry != 0) require(expiry > block.timestamp, "expiry<=now");

        orderId = nextOrderId++;
        orders[orderId] = Order({
            maker: msg.sender,
            resourceType: resourceType,
            side: side,
            nodeIdHash: nodeIdHash,
            allocationNodeId: allocationNodeId,
            unitPrice: unitPrice,
            quantity: quantity,
            filled: 0,
            expiry: expiry,
            active: true
        });

        _openIndex[orderId] = _openOrderIds.length + 1;
        _openOrderIds.push(orderId);

        emit OrderCreated(
            orderId,
            msg.sender,
            resourceType,
            side,
            nodeIdHash,
            allocationNodeId,
            unitPrice,
            quantity,
            expiry
        );
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

        string memory accessKey = _generateAccessKey(orderId, buyer, amount, o.resourceType);
        emit ResourceCollected(bytes32(orderId), buyer, accessKey, o.allocationNodeId);
    }

    /// @dev Simulates an encrypted JWT / SSH bare-metal access token or energy migration bundle ID.
    function _generateAccessKey(
        uint256 orderId,
        address buyer,
        uint256 amount,
        ResourceType resourceType
    ) internal view returns (string memory) {
        bytes32 seed = keccak256(abi.encodePacked(orderId, buyer, amount, block.timestamp, block.prevrandao));
        string memory hexSeed = _bytes32ToHex(seed);

        if (resourceType == ResourceType.GPU_HOUR) {
            return string(abi.encodePacked("sonergy_sk_live_", hexSeed));
        }
        return string(abi.encodePacked("sonergy_mig_bundle_", hexSeed));
    }

    function _bytes32ToHex(bytes32 data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            uint8 b = uint8(data[i]);
            str[i * 2] = alphabet[b >> 4];
            str[i * 2 + 1] = alphabet[b & 0x0f];
        }
        return string(str);
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
