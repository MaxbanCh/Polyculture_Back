import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";

export async function get_hash(password: string): Promise<string> {
  const saltRounds = 10;
  const salt = await bcrypt.genSalt(saltRounds);
  return await bcrypt.hash(password, salt);
}