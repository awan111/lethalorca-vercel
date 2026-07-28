import { Connection, PublicKey } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Keypair, Transaction } from '@solana/web3.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { playerWallet, amount } = req.body;

    if (!playerWallet || !amount) {
      return res.status(400).json({ success: false, error: 'Missing wallet or amount' });
    }

    // Config
    const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const TOKEN_MINT = new PublicKey('7RqpgT532tsYakbgnTXECC4MHTEGu5HzBxVAkAAHpump');
    const DEV_WALLET = new PublicKey('EeNDDkvVzqL6TBLVhPCH4GJEKsZeC4g4zD21tLu4UtWS');
    const TOKEN_DECIMALS = 6;

    // Load private key
    if (!process.env.SOLANA_PRIVATE_KEY) {
      return res.status(500).json({ success: false, error: 'Private key not configured' });
    }

    let devKeypair;
    try {
      const privateKeyArray = JSON.parse(process.env.SOLANA_PRIVATE_KEY);
      devKeypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Invalid private key format' });
    }

    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const playerPubkey = new PublicKey(playerWallet);

    console.log(`[${new Date().toISOString()}] Transfer: ${amount} LORCA to ${playerWallet}`);

    // Get token accounts
    const devTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, DEV_WALLET);
    const playerTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, playerPubkey);

    // Get blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

    // Create transaction
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: DEV_WALLET,
    });

    const amountInTokens = Math.floor(amount * Math.pow(10, TOKEN_DECIMALS));

    const transferInstruction = createTransferInstruction(
      devTokenAccount,
      playerTokenAccount,
      DEV_WALLET,
      amountInTokens,
      [],
      TOKEN_PROGRAM_ID
    );

    transaction.add(transferInstruction);
    transaction.sign(devKeypair);

    // Send transaction
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
    });

    console.log(`[${new Date().toISOString()}] Signature: ${signature}`);

    // Confirm
    const confirmation = await connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature,
    });

    if (confirmation.value.err) {
      return res.status(400).json({ success: false, error: 'Transaction failed on chain' });
    }

    console.log(`[${new Date().toISOString()}] ✅ Transfer confirmed!`);

    return res.status(200).json({
      success: true,
      transactionHash: signature,
      message: `Transferred ${amount} LORCA to ${playerWallet}`,
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
