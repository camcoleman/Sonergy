import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  parseUnits,
  keccak256,
  toBytes,
  type Log,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import mockUsdcJson from "../../src/abi/MockUSDC.json";
import marketplaceJson from "../../src/abi/ResourceMarketplace.json";
import { ADDRESSES_BY_CHAIN } from "../../src/web3/addresses";
import { DEFAULT_AGENT_ORIGIN_NODE } from "../../src/lib/collection";

const MockUSDC_ABI = (mockUsdcJson as { abi: unknown }).abi;
const Marketplace_ABI = (marketplaceJson as { abi: unknown }).abi;

type Mode = "steady" | "crisis";

/** Hardhat account #1 — used as plant floor seller on local chain. */
const HARDHAT_SELLER_PK =
  "0x59c6995e998f97a5a0044966f094538e90b531723c6f9891635a21494f27199" as const;

function nodeHash(nodeId: string) {
  return keccak256(toBytes(nodeId));
}

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseResourceCollected(logs: Log[], marketplaceAddress: `0x${string}`) {
  for (const log of logs) {
    if (log.address?.toLowerCase() !== marketplaceAddress.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: Marketplace_ABI as never,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "ResourceCollected") {
        return decoded.args as {
          orderId: `0x${string}`;
          buyer: `0x${string}`;
          accessKey: string;
          allocationNodeId: string;
        };
      }
    } catch {
      // not this event
    }
  }
  return null;
}

function parseFillAmount(logs: Log[], marketplaceAddress: `0x${string}`) {
  for (const log of logs) {
    if (log.address?.toLowerCase() !== marketplaceAddress.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: Marketplace_ABI as never,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "OrderFilled") {
        const args = decoded.args as { amount?: bigint };
        return args.amount ?? 1n;
      }
    } catch {
      // not this event
    }
  }
  return 1n;
}

async function ensureUsdcApproval(
  walletClient: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  usdc: `0x${string}`,
  marketplace: `0x${string}`,
) {
  const approveHash = await walletClient.writeContract({
    address: usdc,
    abi: MockUSDC_ABI as never,
    functionName: "approve",
    args: [marketplace, parseUnits("1000000", 6)],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
}

async function main() {
  const mode = (process.argv.includes("--crisis") ? "crisis" : "steady") as Mode;
  const agentPk = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;
  if (!agentPk) {
    throw new Error("Missing AGENT_PRIVATE_KEY (hex private key starting with 0x)");
  }

  const chainId = Number(process.env.CHAIN_ID || 31337);
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
  const sellerPk = (process.env.SELLER_PRIVATE_KEY as `0x${string}` | undefined) ?? HARDHAT_SELLER_PK;
  const agentOrigin = process.env.AGENT_ORIGIN_NODE ?? DEFAULT_AGENT_ORIGIN_NODE;

  const addrs = ADDRESSES_BY_CHAIN[chainId];
  if (!addrs) throw new Error(`No addresses configured for chainId ${chainId} in src/web3/addresses.ts`);

  const agentAccount = privateKeyToAccount(agentPk);
  const sellerAccount = privateKeyToAccount(sellerPk);

  console.log(`Agent (buyer): ${agentAccount.address}`);
  console.log(`Seller (plant): ${sellerAccount.address}`);
  console.log(`Origin node: ${agentOrigin}`);
  console.log(`Mode: ${mode}`);
  console.log(`RPC: ${rpcUrl}`);

  const publicClient = createPublicClient({
    chain: chainId === 31337 ? hardhat : undefined,
    transport: http(rpcUrl),
  });

  const agentClient = createWalletClient({
    account: agentAccount,
    chain: chainId === 31337 ? hardhat : undefined,
    transport: http(rpcUrl),
  });

  const sellerClient = createWalletClient({
    account: sellerAccount,
    chain: chainId === 31337 ? hardhat : undefined,
    transport: http(rpcUrl),
  });

  if (chainId === 31337 && process.argv.includes("--mint-local")) {
    for (const client of [agentClient, sellerClient]) {
      const hash = await client.writeContract({
        address: addrs.mockUSDC,
        abi: MockUSDC_ABI as never,
        functionName: "mint",
        args: [client.account.address, parseUnits("10000", 6)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    }
    console.log("Minted local USDC to agent + seller.");
  }

  await ensureUsdcApproval(agentClient, publicClient, addrs.mockUSDC, addrs.marketplace);

  const plants = ["kansas-plant", "texas-grid", "oregon-solar", "iceland-green"];

  while (true) {
    const plantNodeId = pick(plants);
    const plantLabel = plantNodeId;
    const isGpuCollection = mode === "crisis" ? Math.random() < 0.65 : Math.random() < 0.5;
    const resourceType = isGpuCollection ? 0 : 1; // GPU_HOUR / KWH
    const fillQty = BigInt(
      isGpuCollection
        ? mode === "crisis"
          ? 12 + Math.floor(Math.random() * 8)
          : 5 + Math.floor(Math.random() * 10)
        : mode === "crisis"
          ? 80 + Math.floor(Math.random() * 40)
          : 20 + Math.floor(Math.random() * 30),
    );

    const basePrice = resourceType === 0 ? 0.45 : 0.08;
    const multiplier = mode === "crisis" ? 1.7 : 1.0;
    const unitPrice = parseUnits((basePrice * multiplier * (0.85 + Math.random() * 0.3)).toFixed(3), 6);

    // Plant posts inventory (SELL).
    const createHash = await sellerClient.writeContract({
      address: addrs.marketplace,
      abi: Marketplace_ABI as never,
      functionName: "createOrder",
      args: [resourceType, 1, nodeHash(plantNodeId), plantLabel, unitPrice, fillQty * 2n, 0],
    });
    await publicClient.waitForTransactionReceipt({ hash: createHash });

    const openIds = (await publicClient.readContract({
      address: addrs.marketplace,
      abi: Marketplace_ABI as never,
      functionName: "getOpenOrderIds",
    })) as bigint[];

    const orderId = openIds[openIds.length - 1];
    if (!orderId) {
      console.warn("No open order to fill.");
      await sleep(4000);
      continue;
    }

    const totalCost = fillQty * unitPrice;
    const approveHash = await agentClient.writeContract({
      address: addrs.mockUSDC,
      abi: MockUSDC_ABI as never,
      functionName: "approve",
      args: [addrs.marketplace, totalCost],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });

    const fillHash = await agentClient.writeContract({
      address: addrs.marketplace,
      abi: Marketplace_ABI as never,
      functionName: "fillOrder",
      args: [orderId, fillQty],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: fillHash });

    const collected = parseResourceCollected(receipt.logs, addrs.marketplace);
    const amount = parseFillAmount(receipt.logs, addrs.marketplace);

    if (collected) {
      const venueName =
        collected.allocationNodeId.includes("kansas") ? "Kansas Plant" : collected.allocationNodeId;

      if (resourceType === 0) {
        console.log(
          `[Collection] Agent acquired keys for ${amount.toString()} GPUs at ${venueName}. Establishing secure tunnel...`,
        );
        console.log(`  accessKey: ${collected.accessKey.slice(0, 42)}…`);
        console.log(`  payload: routing inference shards to bare-metal floor @ ${plantLabel}`);
      } else {
        console.log(
          `[Collection] Energy bundle secured (${amount.toString()} kWh) @ ${venueName}. Spawning migration arc...`,
        );
        console.log(`  migration: ${agentOrigin} → ${plantLabel} (workload follows fuel)`);
        console.log(`  bundle: ${collected.accessKey.slice(0, 42)}…`);
      }
    } else {
      console.log(`Filled order #${orderId.toString()} but ResourceCollected not found in receipt.`);
    }

    await sleep(mode === "crisis" ? 3500 : 7000);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
