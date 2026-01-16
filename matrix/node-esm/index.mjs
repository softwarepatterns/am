import { Am, AuthError } from "@softwarepatterns/am";

// Test: Can instantiate Am
const am = new Am({
  baseUrl: "https://example.com",
});

// Test: Core methods exist and are functions
const methods = ["signIn", "signUp", "restoreSession", "createSession", "checkEmail"];
for (const method of methods) {
  if (typeof am[method] !== "function") {
    console.error(`FAIL: am.${method} is not a function`);
    process.exit(1);
  }
}

// Test: AuthError can be instantiated
const err = new AuthError({ type: "test", title: "Test Error", status: 400 });
if (err.status !== 400 || err.title !== "Test Error") {
  console.error("FAIL: AuthError not working correctly");
  process.exit(1);
}

console.log("PASS: ESM consumer tests passed");
