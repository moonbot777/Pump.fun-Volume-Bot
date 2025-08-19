import { Keypair, SystemProgram, Transaction, Connection, ComputeBudgetProgram, TransactionInstruction, TransactionMessage, AddressLookupTableProgram, PublicKey, SYSVAR_RENT_PUBKEY, Commitment, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { createAssociatedTokenAccountIdempotentInstruction, createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { AnchorProvider } from "@coral-xyz/anchor";

import { PumpFunSDK } from "../../module/pumpfun_sdk/pumpfun";
import {
  // constants
  COMMITMENT,
  RETRY_MODE,
  // executor
  distributeSol,
  // utils
  sleep,
  DEBUG_MODE,
  RPC_ENDPOINT,
  RPC_WEBSOCKET_ENDPOINT,
  Keys,
} from "../../module"
import { BN } from "bn.js";

// Volume-specific constants
const VOLUME_DURATION = 300; // 5 minutes in seconds
const VOLUME_WALLET_NUM = 10; // Number of volume wallets
const VOLUME_BUY_AMOUNT_MAX = 0.005; // Maximum SOL amount per volume transaction
const VOLUME_BUY_AMOUNT_MIN = 0.001; // Minimum SOL amount per volume transaction
const GLOBAL_MINT = "11111111111111111111111111111111"; // Default global mint address

const commitment: Commitment = COMMITMENT === "processed" ? "processed" : COMMITMENT === "confirmed" ? "confirmed" : "finalized"
const connection = new Connection(RPC_ENDPOINT, {
  wsEndpoint: RPC_WEBSOCKET_ENDPOINT, commitment
})
const sdk = new PumpFunSDK(new AnchorProvider(connection, new NodeWallet(new Keypair()), { commitment }));
let solBalEnough: boolean = true
let volumeNum = 0

export const volume = async (keysData: Keys) => {
  const {volumes, mint: mintKp, mainKp} = keysData
  const global_mint = new PublicKey(GLOBAL_MINT)
  const microLamports = 620_500
  const distributionNum = 20
  const units = 120_000
  const fee = Math.floor(microLamports * units / 10 ** 6)
  const distSolAmount = VOLUME_BUY_AMOUNT_MAX * LAMPORTS_PER_SOL // Convert SOL to lamports
  console.log("Distribution amount", distSolAmount)

  const round = Math.ceil(VOLUME_WALLET_NUM / distributionNum)
  const volumeQueue = new Array(round).fill(true)

  const distributionInterval = Math.floor(VOLUME_DURATION / round * 1000)       // millisecond

  const mint = mintKp.publicKey

  let { feeRecipient } = await sdk.getGlobalAccount(commitment);
  const associatedBondingCurve = getAssociatedTokenAddressSync(
    mint,
    sdk.getBondingCurvePDA(mint),
    true
  );

  // Process volume transactions
  for (let i = 0; i < volumes.length; i++) {
    const volumeWallet = volumes[i];
    
    try {
      // Check wallet balance
      const balance = await connection.getBalance(volumeWallet.publicKey);
      if (balance < distSolAmount) {
        console.log(`Volume wallet ${i} has insufficient balance: ${balance / LAMPORTS_PER_SOL} SOL`);
        continue;
      }

      // Generate random amount between min and max
      const randomAmount = Math.random() * (VOLUME_BUY_AMOUNT_MAX - VOLUME_BUY_AMOUNT_MIN) + VOLUME_BUY_AMOUNT_MIN;
      const lamports = Math.floor(randomAmount * LAMPORTS_PER_SOL);

      console.log(`Processing volume transaction ${i + 1}/${volumes.length} with ${randomAmount.toFixed(4)} SOL`);

      // Add delay between transactions
      if (i > 0) {
        await sleep(distributionInterval);
      }

      volumeNum++;
    } catch (error) {
      console.error(`Error processing volume wallet ${i}:`, error);
    }
  }

  console.log(`Volume processing completed. Total transactions: ${volumeNum}`);
  return volumeNum;
}

// Uncomment to run directly
// volume()
