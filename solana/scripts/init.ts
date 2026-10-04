/**
 * One-time cluster setup: initialize the program (mints the fixed $TIME supply),
 * seed categories, create the admin profile and claim from the faucet.
 *
 *   ANCHOR_PROVIDER_URL=https://api.testnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json ts-node scripts/init.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const CATEGORIES = ["Politics", "Business", "Games", "Crypto", "Tech", "Memes", "Random"];

const seed = (s: string) => Buffer.from(s);

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../target/idl/battlechan.json"), "utf8"));
  const program = new anchor.Program(idl, provider);
  const pid = program.programId;
  const find = (...s: Buffer[]) => anchor.web3.PublicKey.findProgramAddressSync(s, pid)[0];

  const config = find(seed("config"));
  const admin = provider.wallet.publicKey;
  console.log("program   ", pid.toBase58());
  console.log("admin     ", admin.toBase58());

  const existing = await program.account.config.fetchNullable(config);
  if (!existing) {
    const sig = await program.methods.initialize().accounts({ admin } as any).rpc();
    console.log("initialized:", sig);
  } else {
    console.log("already initialized, skipping initialize()");
  }

  let cfg: any = await program.account.config.fetch(config);
  const have = new Set<string>();
  for (let i = 0; i < cfg.categoryCount; i++) {
    const c: any = await program.account.category.fetch(
      find(seed("category"), new anchor.BN(i).toArrayLike(Buffer, "le", 2))
    );
    have.add(c.name);
  }
  for (const name of CATEGORIES) {
    if (have.has(name)) continue;
    cfg = await program.account.config.fetch(config);
    const catPda = find(seed("category"), new anchor.BN(cfg.categoryCount).toArrayLike(Buffer, "le", 2));
    await program.methods.createCategory(name).accountsPartial({ admin, config, category: catPda }).rpc();
    console.log("category:", name);
  }

  const profile = find(seed("profile"), admin.toBuffer());
  if (!(await program.account.userProfile.fetchNullable(profile))) {
    await program.methods.createProfile(null).accountsPartial({ user: admin, profile }).rpc();
    console.log("admin profile created");
  }
  console.log("\nDone. $TIME mint:", find(seed("time_mint")).toBase58());
  console.log("Admin $TIME ATA:", getAssociatedTokenAddressSync(find(seed("time_mint")), admin).toBase58());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
