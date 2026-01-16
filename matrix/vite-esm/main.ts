import { Am, AuthError } from "@softwarepatterns/am";

// Test: Can instantiate Am
const am = new Am({
  baseUrl: "https://example.com",
});

// Test: Core methods exist
const methods = ["signIn", "signUp", "restoreSession", "createSession", "checkEmail"];
for (const method of methods) {
  if (typeof (am as any)[method] !== "function") {
    throw new Error(`am.${method} is not a function`);
  }
}

// Test: AuthError works
const err = new AuthError({ type: "test", title: "Test Error", status: 400 });
if (err.status !== 400) {
  throw new Error("AuthError not working");
}

console.log("PASS: Vite ESM build succeeded");
