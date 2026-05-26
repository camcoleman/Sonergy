import { network } from "hardhat";

async function main() {
  const connection = await network.connect();
  const { ethers } = connection;

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying from: ${deployer.address}`);

  const MockUSDC = await ethers.getContractFactory("MockUSDC", deployer);
  const usdc = await MockUSDC.deploy(deployer.address);
  await usdc.waitForDeployment();

  const ResourceMarketplace = await ethers.getContractFactory("ResourceMarketplace", deployer);
  const market = await ResourceMarketplace.deploy(await usdc.getAddress());
  await market.waitForDeployment();

  const usdcAddr = await usdc.getAddress();
  const marketAddr = await market.getAddress();

  console.log(`MockUSDC: ${usdcAddr}`);
  console.log(`ResourceMarketplace: ${marketAddr}`);

  console.log("\nPaste into src/web3/addresses.ts:");
  console.log(
    JSON.stringify(
      {
        mockUSDC: usdcAddr,
        marketplace: marketAddr,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

