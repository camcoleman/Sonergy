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

    await usdc.connect(owner).mint(taker.address, 1_000_000_000);
    await usdc.connect(taker).approve(await market.getAddress(), 1_000_000_000);

    const nodeHash = ethers.keccak256(ethers.toUtf8Bytes("oregon-solar"));
    const unitPrice = 250_000;
    const qty = 10;

    await market.connect(maker).createOrder(0, 1, nodeHash, "oregon-solar", unitPrice, qty, 0);

    const orderIds = await market.getOpenOrderIds();
    expect(orderIds.length).to.equal(1);
    const orderId = orderIds[0];

    const makerBalBefore = await usdc.balanceOf(maker.address);
    const tx = await market.connect(taker).fillOrder(orderId, 4);
    const receipt = await tx.wait();
    const makerBalAfter = await usdc.balanceOf(maker.address);

    expect(makerBalAfter - makerBalBefore).to.equal(BigInt(4) * BigInt(unitPrice));

    const collected = receipt.logs.find((l: { fragment?: { name: string } }) => l.fragment?.name === "ResourceCollected");
    expect(collected).to.exist;
  });

  it("fills a BUY order and emits compute access key", async () => {
    const [owner, maker, taker] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.connect(owner).deploy(owner.address);
    await usdc.waitForDeployment();

    const Marketplace = await ethers.getContractFactory("ResourceMarketplace");
    const market = await Marketplace.connect(owner).deploy(await usdc.getAddress());
    await market.waitForDeployment();

    await usdc.connect(owner).mint(maker.address, 1_000_000_000);
    await usdc.connect(maker).approve(await market.getAddress(), 1_000_000_000);

    const nodeHash = ethers.keccak256(ethers.toUtf8Bytes("kansas-plant"));
    const unitPrice = 100_000;
    const qty = 5;

    await market.connect(maker).createOrder(1, 0, nodeHash, "kansas-plant", unitPrice, qty, 0);

    const [orderId] = await market.getOpenOrderIds();
    const takerBalBefore = await usdc.balanceOf(taker.address);
    const tx = await market.connect(taker).fillOrder(orderId, 2);
    const receipt = await tx.wait();
    const takerBalAfter = await usdc.balanceOf(taker.address);

    expect(takerBalAfter - takerBalBefore).to.equal(BigInt(2) * BigInt(unitPrice));

    const collected = receipt.logs.find((l: { fragment?: { name: string } }) => l.fragment?.name === "ResourceCollected");
    expect(collected).to.exist;
    const args = collected.args;
    expect(args.accessKey).to.match(/^sonergy_mig_bundle_/);
    expect(args.allocationNodeId).to.equal("kansas-plant");
  });
});
