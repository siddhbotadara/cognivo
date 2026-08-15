import React, { useEffect } from "react";
import { Route, Routes, Navigate } from "react-router-dom";

import HomePage from "./pages/HomePage";
import Boarding from "./pages/Boarding";
import Dashboard from "./pages/Dashboard";

import {
  RequireProfile,
  BlockIfProfileExists,
} from "./routes/RouteGuards";

const App = () => {

  // NEW: Check for saved font when the app loads and apply it to the entire body
  useEffect(() => {
    const savedFont = localStorage.getItem("user_font");
    if (savedFont) {
      document.body.style.fontFamily = `"${savedFont}", sans-serif`;
    }
  }, []);

  return (
    <Routes>
      {/* Home */}
      <Route
        path="/"
        element={
          <BlockIfProfileExists>
            <HomePage />
          </BlockIfProfileExists>
        }
      />

      {/* Onboarding (blocked after completion) */}
      <Route
        path="/onboarding"
        element={
          <BlockIfProfileExists>
            <Boarding />
          </BlockIfProfileExists>
        }
      />

      {/* App (protected) */}
      <Route
        path="/app"
        element={
          <RequireProfile>
            <Dashboard />
          </RequireProfile>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default App;