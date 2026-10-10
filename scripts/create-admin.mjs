// Creates the first administrator (or promotes an existing user).
// There is no public admin sign-up: this script, run with the secret key, is
// the only way to grant the admin role.
//
//   npm run db:admin -- you@example.com                    create or promote
//   npm run db:admin -- you@example.com --reset-password   also set a new password
//
// The password is read from a hidden prompt, or from ADMIN_PASSWORD if set.
import { createInterface } from "node:readline";
import { fail, getServiceClient, ok } from "./_client.mjs";

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(question);
    // Suppress echo of typed characters.
    rl._writeToOutput = () => {};
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const args = process.argv.slice(2);
const resetPassword = args.includes("--reset-password");
const email = (args.find((a) => !a.startsWith("--")) ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();

async function askPassword() {
  const password = process.env.ADMIN_PASSWORD ?? (await promptHidden("Choose a password (min 12 characters): "));
  if (password.length < 12) fail("The password must be at least 12 characters long.");
  if (!process.env.ADMIN_PASSWORD) {
    const again = await promptHidden("Repeat the password: ");
    if (again !== password) fail("The passwords did not match.");
  }
  return password;
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fail("Provide the administrator's email address:\n  npm run db:admin -- you@example.com");
}

const supabase = getServiceClient();

async function findUser(address) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Could not list users: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === address);
    if (match) return match;
    if (data.users.length < 200) break;
  }
  return null;
}

let user = await findUser(email);

if (user && resetPassword) {
  const { error } = await supabase.auth.admin.updateUserById(user.id, { password: await askPassword(), email_confirm: true });
  if (error) fail(`Could not set the new password: ${error.message}`);
  ok(`Password updated for ${email}.`);
} else if (user) {
  ok(`User ${email} already exists; promoting to administrator (password unchanged).`);
} else {
  const password = await askPassword();
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) fail(`Could not create the user: ${error.message}`);
  user = data.user;
  ok(`Created user ${email}.`);
}

const { error: profileError } = await supabase
  .from("profiles")
  .upsert({ id: user.id, email, role: "admin" }, { onConflict: "id" });
if (profileError) fail(`Could not grant the admin role (have the migrations been applied?): ${profileError.message}`);

const { data: check } = await supabase.from("profiles").select("role").eq("id", user.id).single();
if (check?.role !== "admin") fail("Verification failed: the profile is not marked as admin.");

ok(`${email} is now an administrator. Sign in at /admin/login.`);
console.log("\n  Tip: in Supabase → Authentication → Sign In / Providers, turn off \"Allow new users to sign up\".");
