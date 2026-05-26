import { createPublicClient, createWalletClient, http, parseUnits, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import mockUsdcJson from "../../src/abi/MockUSDC.json";
import marketplaceJson from "../../src/abi/ResourceMarketplace.json";
import { ADDRESSES_BY_CHAIN } from "../../src/web3/addresses";

const MockUSDC_ABI = (mockUsdcJson as any).abi;
const Marketplace_ABI = (marketplaceJson as any).abi;

type Mode = "steady" | "crisis";

function nodeHash(nodeId: string) {
  return keccak256(toBytes(nodeId));
}

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const mode = (process.argv.includes("--crisis") ? "crisis" : "steady") as Mode;
  const pk = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) {
    throw new Error("Missing AGENT_PRIVATE_KEY (hex private key starting with 0x)");
  }

  const chainId = Number(process.env.CHAIN_ID || 31337);
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";

  const addrs = ADDRESSES_BY_CHAIN[chainId];
  if (!addrs) throw new Error(`No addresses configured for chainId ${chainId} in src/web3/addresses.ts`);

  const account = privateKeyToAccount(pk);
  console.log(`Agent address: ${account.address}`);
  console.log(`Mode: ${mode}`);
  console.log(`RPC: ${rpcUrl}`);

  const publicClient = createPublicClient({
    chain: chainId === 31337 ? hardhat : undefined,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: chainId === 31337 ? hardhat : undefined,
    transport: http(rpcUrl),
  });

  // If local, mint agent USDC (owner is the deployer; so this only works if agent IS deployer on local).
  if (chainId === 31337 && process.argv.includes("--mint-local")) {
    const amount = parseUnits("1000", 6);
    const hash = await walletClient.writeContract({
      address: addrs.mockUSDC,
      abi: MockUSDC_ABI,
      functionName: "mint",
      args: [account.address, amount],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("Minted local USDC to agent.");
  }

  // Approve marketplace
  {
    const approveHash = await walletClient.writeContract({
      address: addrs.mockUSDC,
      abi: MockUSDC_ABI,
      functionName: "approve",
      args: [addrs.marketplace, parseUnits("1000000", 6)],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const nodes = ["oregon-solar", "texas-grid", "tokyo-gpu", "iceland-green"];

  // Create a small stream of orders.
  while (true) {
    const nodeId = pick(nodes);
    const isBuy = mode === "crisis" ? Math.random() < 0.8 : Math.random() < 0.55;
    const side = isBuy ? 0 : 1; // BUY=0, SELL=1
    const resourceType = Math.random() < 0.6 ? 0 : 1; // GPU_HOUR / KWH

    const basePrice = resourceType === 0 ? 0.45 : 0.08; // GPU-hours are pricier
    const multiplier = mode === "crisis" ? 1.7 : 1.0;
    const unitPrice = parseUnits((basePrice * multiplier * (0.8 + Math.random() * 0.6)).toFixed(3), 6);
    const quantity = BigInt(mode === "crisis" ? 20 + Math.floor(Math.random() * 40) : 5 + Math.floor(Math.random() * 15));

    const txHash = await walletClient.writeContract({
      address: addrs.marketplace,
      abi: Marketplace_ABI,
      functionName: "createOrder",
      args: [resourceType, side, nodeHash(nodeId), unitPrice, quantity, 0],
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`Created order: ${isBuy ? "BUY" : "SELL"} ${resourceType === 0 ? "GPU_HOUR" : "KWH"} qty=${quantity.toString()} price=${unitPrice.toString()} node=${nodeId}`);

    await sleep(mode === "crisis" ? 2500 : 6000);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

