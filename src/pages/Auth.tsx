// src/pages/Auth.tsx

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Auth() {

  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [shopName, setShopName] = useState("");

  const [role, setRole] = useState("customer");

  const handleSubmit = async () => {

    if (isLogin) {

      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        alert(error.message);
      } else {
        alert("Login successful");
      }

    } else {

      const { error } =
        await supabase.auth.signUp({
          email,
          password,

          options: {
            data: {
              full_name: fullName,
              shop_name: shopName,
              role: role,
            },
          },
        });

      if (error) {
        alert(error.message);
      } else {
        alert("Signup successful");
      }
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white">

      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-2xl border border-zinc-800">

        <h1 className="text-3xl font-bold mb-2">
          Retail Intelligence
        </h1>

        <p className="text-zinc-400 mb-6">
          AI Powered Supermarket Platform
        </p>

        <div className="space-y-4">

          {!isLogin && (
            <>
              <input
                className="w-full p-3 rounded bg-zinc-800"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) =>
                  setFullName(e.target.value)
                }
              />

              <select
                className="w-full p-3 rounded bg-zinc-800"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value)
                }
              >
                <option value="customer">
                  Customer
                </option>

                <option value="shop_admin">
                  Shop Admin
                </option>
              </select>

              {role === "shop_admin" && (
                <input
                  className="w-full p-3 rounded bg-zinc-800"
                  placeholder="Shop Name"
                  value={shopName}
                  onChange={(e) =>
                    setShopName(e.target.value)
                  }
                />
              )}
            </>
          )}

          <input
            className="w-full p-3 rounded bg-zinc-800"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          <input
            type="password"
            className="w-full p-3 rounded bg-zinc-800"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
          />

          <button
            onClick={handleSubmit}
            className="w-full bg-green-600 hover:bg-green-700 p-3 rounded font-bold"
          >
            {isLogin ? "Login" : "Create Account"}
          </button>

          <button
            onClick={() =>
              setIsLogin(!isLogin)
            }
            className="w-full text-sm text-zinc-400"
          >
            {isLogin
              ? "Create new account"
              : "Already have account?"}
          </button>
        </div>
      </div>
    </div>
  );
}