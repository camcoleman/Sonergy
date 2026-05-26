import { expect } from "chai";
import hre from "hardhat";

let ethers: any;

before(async function () {
  ({ ethers } = await hre.network.create());
});

describe("ResourceMarketplace", function () {
  it("creates and fills a SELL order (taker pays maker)", async () => {
    const [owner, maker, taker] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.connect(owner).deploy(owner.address);
    await usdc.waitForDeployment();

    const Marketplace = await ethers.getContractFactory("ResourceMarketplace");
    const market = await Marketplace.connect(owner).deploy(await usdc.getAddress());
    await market.waitForDeployment();

    // Fund taker for payment
    await usdc.connect(owner).mint(taker.address, 1_000_000_000); // 1000 mUSDC (6 decimals)
    await usdc.connect(taker).approve(await market.getAddress(), 1_000_000_000);

    const nodeHash = ethers.keccak256(ethers.toUtf8Bytes("oregon-solar"));
    const unitPrice = 250_000; // 0.25 mUSDC per unit
    const qty = 10;

    const tx = await market
      .connect(maker)
      .createOrder(0, 1, nodeHash, unitPrice, qty, 0); // GPU_HOUR, SELL
    const receipt = await tx.wait();
    const created = receipt?.logs.find(() => true);
    expect(created).to.exist;

    const orderIds = await market.getOpenOrderIds();
    expect(orderIds.length).to.equal(1);
    const orderId = orderIds[0];

    const makerBalBefore = await usdc.balanceOf(maker.address);
    await market.connect(taker).fillOrder(orderId, 4);
    const makerBalAfter = await usdc.balanceOf(maker.address);

    expect(makerBalAfter - makerBalBefore).to.equal(BigInt(4) * BigInt(unitPrice));
  });

  it("fills a BUY order (maker pays taker)", async () => {
    const [owner, maker, taker] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.connect(owner).deploy(owner.address);
    await usdc.waitForDeployment();

    const Marketplace = await ethers.getContractFactory("ResourceMarketplace");
    const market = await Marketplace.connect(owner).deploy(await usdc.getAddress());
    await market.waitForDeployment();

    // Fund maker for payment
    await usdc.connect(owner).mint(maker.address, 1_000_000_000);
    await usdc.connect(maker).approve(await market.getAddress(), 1_000_000_000);

    const nodeHash = ethers.keccak256(ethers.toUtf8Bytes("iceland-green"));
    const unitPrice = 100_000;
    const qty = 5;

    await market.connect(maker).createOrder(1, 0, nodeHash, unitPrice, qty, 0); // KWH, BUY

    const [orderId] = await market.getOpenOrderIds();
    const takerBalBefore = await usdc.balanceOf(taker.address);
    await market.connect(taker).fillOrder(orderId, 2);
    const takerBalAfter = await usdc.balanceOf(taker.address);

    expect(takerBalAfter - takerBalBefore).to.equal(BigInt(2) * BigInt(unitPrice));
  });
});

