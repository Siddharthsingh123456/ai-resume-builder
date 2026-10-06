
import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./enhancements.js";

/* =========================================================
   APPLICATION CONFIGURATION
========================================================= */

const APP_CONFIG = {
  name: "AI Resume Builder",
  eyebrow: "CAREER TOOL",
  description:
    "Build an ATS-friendly resume with AI-assisted writing, a live preview and print-ready output.",
  title: "Build a resume that tells your story clearly.",
};

const DEFAULT_PROFILE = {
  name: "Your Name",
  role: "MERN Stack Developer",
  email: "you@example.com",
  phone: "",
  summary: "",
  skills: "React, Node.js, MongoDB, Express",
};

/* =========================================================
   API HELPER
   Prevents JSON parsing crashes when server returns HTML/text.
========================================================= */

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body
        ? {
            "Content-Type": "application/json",
          }
        : {}),
      ...(options.headers || {}),
    },
  });

  const contentType =
    response.headers.get("content-type") || "";

  let data = {};

  try {
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();

      data = text
        ? {
            message: text,
          }
        : {};
    }
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

/* =========================================================
   APP
========================================================= */

function App() {
  /* -------------------------------------------------------
     Navigation
  ------------------------------------------------------- */

  const [page, setPage] = useState("home");
  const [mobileNav, setMobileNav] = useState(false);

  /* -------------------------------------------------------
     Authentication
  ------------------------------------------------------- */

  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);

  /* -------------------------------------------------------
     AI
  ------------------------------------------------------- */

  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  /* -------------------------------------------------------
     Billing
  ------------------------------------------------------- */

  const [planMessage, setPlanMessage] = useState("");
  const [billingLoading, setBillingLoading] = useState(false);

  /* -------------------------------------------------------
     Resume Profile
  ------------------------------------------------------- */

  const [profile, setProfile] = useState(DEFAULT_PROFILE);

  /* =======================================================
     SESSION CHECK
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const data = await apiRequest("/api/auth/me");

        if (!mounted) return;

        if (data?.user) {
          setUser(data.user);

          if (data.user.email) {
            setProfile((previous) => ({
              ...previous,
              email:
                previous.email === "you@example.com"
                  ? data.user.email
                  : previous.email,
            }));
          }
        } else {
          setUser(null);
        }
      } catch {
        if (mounted) {
          setUser(null);
          localStorage.removeItem("ai_user");
        }
      } finally {
        if (mounted) {
          setSessionLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  /* =======================================================
     NAVIGATION HELPERS
  ======================================================= */

  const navigate = useCallback((nextPage) => {
    setPage(nextPage);
    setMobileNav(false);
  }, []);

  const goToAuth = useCallback((mode) => {
    setAuthMode(mode);
    setAuthMessage("");
    setShowPassword(false);
    setMobileNav(false);
    setPage("login");
  }, []);

  /* =======================================================
     PROFILE UPDATE
     Functional state update prevents stale-state bugs.
  ======================================================= */

  const updateProfile = useCallback((key, value) => {
    setProfile((previous) => ({
      ...previous,
      [key]: value,
    }));
  }, []);

  /* =======================================================
     AUTHENTICATION
  ======================================================= */

  async function auth() {
    setAuthMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setAuthMessage("Please enter your email address.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setAuthMessage("Enter a valid email address.");
      return;
    }

    if (!password) {
      setAuthMessage("Please enter your password.");
      return;
    }

    if (password.length < 8) {
      setAuthMessage(
        "Password must be at least 8 characters."
      );
      return;
    }

    setAuthBusy(true);

    try {
      const data = await apiRequest(
        `/api/auth/${authMode}`,
        {
          method: "POST",
          body: JSON.stringify({
            email: cleanEmail,
            password,
          }),
        }
      );

      if (!data?.user) {
        throw new Error(
          "Authentication succeeded, but the server did not return user information."
        );
      }

      setUser(data.user);

      localStorage.setItem(
        "ai_user",
        data.user.email || cleanEmail
      );

      setEmail("");
      setPassword("");
      setAuthMessage("");
      setAuthMode("login");
      setPage("workspace");
    } catch (error) {
      setAuthMessage(
        error?.message ||
          "Authentication failed. Please try again."
      );
    } finally {
      setAuthBusy(false);
    }
  }

  /* =======================================================
     LOGOUT
  ======================================================= */

  async function logout() {
    try {
      await apiRequest("/api/auth/logout", {
        method: "POST",
      });
    } catch {
      // Even if server logout fails, clear client state.
    } finally {
      localStorage.removeItem("ai_user");
      setUser(null);
      setOutput("");
      setPage("home");
      setMobileNav(false);
    }
  }

  /* =======================================================
     AI IMPROVEMENT
  ======================================================= */

  async function improve() {
    if (loading) return;

    setLoading(true);
    setOutput("");

    try {
      const data = await apiRequest("/api/ai", {
        method: "POST",
        body: JSON.stringify({
          section: "summary",
          content:
            profile.summary ||
            "Write a concise professional summary.",
          role:
            profile.role || "Professional",
        }),
      });

      const value =
        data?.answer ||
        data?.result ||
        data?.content ||
        data?.text ||
        "";

      if (!value) {
        throw new Error(
          "The AI service returned an empty response."
        );
      }

      setProfile((previous) => ({
        ...previous,
        summary: value,
      }));

      setOutput(value);
    } catch (error) {
      setOutput(
        error?.message ||
          "Unable to improve your summary right now."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     BILLING
  ======================================================= */

  async function choosePlan(plan) {
    if (!user) {
      goToAuth("login");
      return;
    }

    if (billingLoading) return;

    setBillingLoading(true);
    setPlanMessage("");

    try {
      const data = await apiRequest("/api/billing", {
        method: "POST",
        body: JSON.stringify({
          plan,
        }),
      });

      if (data?.url) {
        setPlanMessage("Redirecting to secure checkout…");

        window.location.href = data.url;
        return;
      }

      setPlanMessage(
        data?.message ||
          "Payment checkout is not configured yet."
      );
    } catch (error) {
      setPlanMessage(
        error?.message ||
          "Unable to start checkout."
      );
    } finally {
      setBillingLoading(false);
    }
  }

  /* =======================================================
     PRINT / PDF
  ======================================================= */

  function exportPDF() {
    window.print();
  }

  /* =======================================================
     USER DISPLAY NAME
  ======================================================= */

  const displayName =
    user?.email?.split("@")?.[0] || "there";

  const avatarLetter =
    user?.email?.charAt(0)?.toUpperCase() || "U";

  /* =======================================================
     LOADING SCREEN
  ======================================================= */

  if (sessionLoading) {
    return (
      <div className="site">
        <main className="auth">
          <div className="authCard">
            <span className="eyebrow">
              AI RESUME BUILDER
            </span>

            <h1>Loading workspace...</h1>

            <p>
              Checking your secure session.
            </p>

            <div className="loadingIndicator">
              <span />
              <span />
              <span />
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="site">

      {/* ===================================================
          NAVIGATION
      =================================================== */}

      <header className="nav navResume">

        <button
          type="button"
          className="logo"
          onClick={() => navigate("home")}
        >
          <span>✦</span>
          <strong>AI resume-builder</strong>
        </button>

        <button
          type="button"
          className="mobileMenu"
          aria-label="Toggle navigation"
          aria-expanded={mobileNav}
          onClick={() =>
            setMobileNav((value) => !value)
          }
        >
          {mobileNav ? "✕" : "☰"}
        </button>

        <nav
          className={
            mobileNav ? "navOpen" : ""
          }
        >
          <button
            type="button"
            onClick={() => navigate("home")}
          >
            Home
          </button>

          <button
            type="button"
            onClick={() => navigate("about")}
          >
            About
          </button>

          <button
            type="button"
            onClick={() => navigate("features")}
          >
            Features
          </button>

          <button
            type="button"
            onClick={() => navigate("pricing")}
          >
            Pricing
          </button>
        </nav>

        <div className="navActions">

          {user ? (
            <>
              <span
                className="userChip"
                title={user.email}
              >
                ● {user.email}
              </span>

              <button
                type="button"
                className="ghost navCta"
                onClick={() =>
                  navigate("workspace")
                }
              >
                Open AI
              </button>

              <button
                type="button"
                className="ghost"
                onClick={logout}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="ghost navCta"
                onClick={() =>
                  goToAuth("register")
                }
              >
                Register
              </button>

              <button
                type="button"
                className="primary"
                onClick={() =>
                  goToAuth("login")
                }
              >
                Login ↗
              </button>
            </>
          )}

        </div>
      </header>

      {/* ===================================================
          HOME
      =================================================== */}

      {page === "home" && (
        <>
          <section className="hero">

            <div className="heroCopy">

              <span className="eyebrow">
                {APP_CONFIG.eyebrow}
              </span>

              <h1>{APP_CONFIG.title}</h1>

              <p>
                {APP_CONFIG.description}
              </p>

              <div className="heroBtns">

                <button
                  type="button"
                  className="primary big"
                  onClick={() =>
                    user
                      ? navigate("workspace")
                      : goToAuth("login")
                  }
                >
                  Build My Resume ↗
                </button>

                <button
                  type="button"
                  className="ghost big"
                  onClick={() =>
                    navigate("features")
                  }
                >
                  Explore features
                </button>

              </div>
            </div>

            <div className="heroVisual">
              <div className="glow" />
              <div className="orb">✦</div>
            </div>

          </section>

          <section className="stats">

            <div>
              <b>ATS</b>
              <span>Friendly structure</span>
            </div>

            <div>
              <b>AI</b>
              <span>Writing assistance</span>
            </div>

            <div>
              <b>LIVE</b>
              <span>Resume preview</span>
            </div>

            <div>
              <b>PDF</b>
              <span>Print-ready output</span>
            </div>

          </section>
        </>
      )}

      {/* ===================================================
          ABOUT
      =================================================== */}

      {page === "about" && (
        <section className="content">

          <span className="eyebrow">
            ABOUT
          </span>

          <h1>
            A complete career workflow.
          </h1>

          <p>
            {APP_CONFIG.description}
          </p>

          <div className="cards">

            <article>
              <b>Build</b>

              <p>
                Enter profile details and structure
                your resume in a clean professional
                layout.
              </p>
            </article>

            <article>
              <b>Improve</b>

              <p>
                Use server-side AI assistance to
                strengthen sections without
                inventing credentials or achievements.
              </p>
            </article>

            <article>
              <b>Export</b>

              <p>
                Use the browser print flow to save
                the finished resume as PDF.
              </p>
            </article>

          </div>
        </section>
      )}

      {/* ===================================================
          FEATURES
      =================================================== */}

      {page === "features" && (
        <section className="content">

          <span className="eyebrow">
            FEATURES
          </span>

          <h1>
            Career-ready capabilities.
          </h1>

          <div className="featureGrid">

            {[
              "Secure session authentication",
              "MongoDB persistence",
              "Live resume preview",
              "AI section improvement",
              "ATS-friendly structure",
              "Print / Save PDF",
              "Stripe-ready plans",
              "Vercel-ready build",
            ].map((feature, index) => (
              <article key={feature}>

                <span>
                  {String(index + 1).padStart(
                    2,
                    "0"
                  )}
                </span>

                <b>{feature}</b>

                <p>
                  Designed for a complete resume
                  product workflow.
                </p>

              </article>
            ))}

          </div>
        </section>
      )}

      {/* ===================================================
          PRICING
      =================================================== */}

      {page === "pricing" && (
        <section className="content">

          <span className="eyebrow">
            PRICING
          </span>

          <h1>
            Plans ready for checkout.
          </h1>

          <div className="pricing">

            <article>

              <span>FREE</span>

              <b>₹0</b>

              <p>
                Core builder and starter AI usage.
              </p>

              <button
                type="button"
                className="ghost"
                onClick={() =>
                  user
                    ? navigate("workspace")
                    : goToAuth("login")
                }
              >
                Start free
              </button>

            </article>

            <article className="featured">

              <span>PRO</span>

              <b>
                ₹499
                <span>/mo</span>
              </b>

              <p>
                Higher AI usage and career workflows.
              </p>

              <button
                type="button"
                className="primary"
                disabled={billingLoading}
                onClick={() =>
                  choosePlan("pro")
                }
              >
                {billingLoading
                  ? "Please wait…"
                  : "Choose Pro"}
              </button>

            </article>

            <article>

              <span>TEAM</span>

              <b>
                ₹1,499
                <span>/mo</span>
              </b>

              <p>
                Team-ready architecture.
              </p>

              <button
                type="button"
                className="ghost"
                disabled={billingLoading}
                onClick={() =>
                  choosePlan("team")
                }
              >
                {billingLoading
                  ? "Please wait…"
                  : "Choose Team"}
              </button>

            </article>

          </div>

          <small className="note">
            {planMessage ||
              "Add Stripe environment variables in Vercel to activate payments."}
          </small>

        </section>
      )}

      {/* ===================================================
          LOGIN / REGISTER
      =================================================== */}

      {page === "login" && (
        <section className="auth">

          <div className="authCard">

            <span className="eyebrow">
              {authMode === "login"
                ? "WELCOME BACK"
                : "CREATE ACCOUNT"}
            </span>

            <h1>
              {authMode === "login"
                ? "Sign in"
                : "Create account"}
            </h1>

            <p>
              Secure access to your resume workspace.
            </p>

            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@example.com"
              disabled={authBusy}
            />

            <div className="passwordField">

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete={
                  authMode === "login"
                    ? "current-password"
                    : "new-password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                placeholder="Password (8+ characters)"
                disabled={authBusy}
              />

              <button
                type="button"
                className="passwordToggle"
                onClick={() =>
                  setShowPassword(
                    (value) => !value
                  )
                }
                disabled={authBusy}
              >
                {showPassword
                  ? "Hide"
                  : "Show"}
              </button>

            </div>

            <button
              type="button"
              className="primary wide"
              onClick={auth}
              disabled={authBusy}
            >
              {authBusy
                ? "Please wait…"
                : authMode === "login"
                ? "Login ↗"
                : "Create account ↗"}
            </button>

            <button
              type="button"
              className="ghost wide"
              disabled={authBusy}
              onClick={() => {
                setAuthMode(
                  (mode) =>
                    mode === "login"
                      ? "register"
                      : "login"
                );

                setAuthMessage("");
                setShowPassword(false);
              }}
            >
              {authMode === "login"
                ? "Need an account? Register"
                : "Already registered? Login"}
            </button>

            {authMessage && (
              <small className="note error">
                {authMessage}
              </small>
            )}

          </div>

        </section>
      )}

      {/* ===================================================
          WORKSPACE
      =================================================== */}

      {page === "workspace" && user && (
        <section className="workspace">

          {/* Dashboard Header */}
          <div className="dashboardTop">

            <div>

              <span className="eyebrow">
                AI RESUME STUDIO
              </span>

              <h1>
                Good to see you,{" "}
                {displayName}.
              </h1>

              <p>
                Build, refine and export a
                professional resume from one
                focused workspace.
              </p>

            </div>

            <div className="dashboardActions">

              <span className="saveStatus">
                <i />
                Draft ready
              </span>

              <button
                type="button"
                className="ghost"
                onClick={() =>
                  navigate("home")
                }
              >
                ← Home
              </button>

              <button
                type="button"
                className="primary"
                onClick={exportPDF}
              >
                Export PDF ↗
              </button>

            </div>

          </div>

          {/* Workspace Stats */}
          <div className="workspaceStats">

            <div>
              <span>RESUME STATUS</span>
              <b>In progress</b>
              <small>
                Keep building your profile
              </small>
            </div>

            <div>
              <span>AI ASSISTANT</span>
              <b>
                {loading ? "Working..." : "Ready"}
              </b>
              <small>
                Improve your summary instantly
              </small>
            </div>

            <div>
              <span>FORMAT</span>
              <b>ATS Ready</b>
              <small>
                Clean, recruiter-friendly layout
              </small>
            </div>

          </div>

          {/* Editor */}
          <div className="editorShell">

            {/* Editor Rail */}
            <aside className="editorRail">

              <div className="railBrand">

                <span>✦</span>

                <div>
                  <b>Resume Studio</b>
                  <small>Editor</small>
                </div>

              </div>

              <button
                type="button"
                className="railItem active"
              >
                <span>01</span>
                Profile
              </button>

              <button
                type="button"
                className="railItem"
                onClick={() =>
                  document
                    .querySelector(
                      ".professional-summary"
                    )
                    ?.scrollIntoView({
                      behavior: "smooth",
                    })
                }
              >
                <span>02</span>
                Summary
              </button>

              <button
                type="button"
                className="railItem"
                onClick={() =>
                  document
                    .querySelector(
                      ".skills-field"
                    )
                    ?.scrollIntoView({
                      behavior: "smooth",
                    })
                }
              >
                <span>03</span>
                Skills
              </button>

              <div className="railBottom">

                <div className="miniAvatar">
                  {avatarLetter}
                </div>

                <div>
                  <b>{user.email}</b>

                  <small>
                    Personal workspace
                  </small>
                </div>

              </div>

            </aside>

            {/* Editor Pane */}
            <div className="editorPane">

              <div className="paneHead">

                <div>

                  <span>PROFILE</span>

                  <h2>
                    Personal information
                  </h2>

                  <p>
                    These details appear at the
                    top of your resume.
                  </p>

                </div>

                <span className="completion">
                  LIVE
                </span>

              </div>

              <div className="formGrid">

                {/* Full Name */}
                <label>

                  <span>
                    FULL NAME
                  </span>

                  <input
                    value={profile.name}
                    onChange={(event) =>
                      updateProfile(
                        "name",
                        event.target.value
                      )
                    }
                    placeholder="Your full name"
                  />

                </label>

                {/* Target Role */}
                <label>

                  <span>
                    TARGET ROLE
                  </span>

                  <input
                    value={profile.role}
                    onChange={(event) =>
                      updateProfile(
                        "role",
                        event.target.value
                      )
                    }
                    placeholder="e.g. MERN Stack Developer"
                  />

                </label>

                {/* Email */}
                <label>

                  <span>EMAIL</span>

                  <input
                    type="email"
                    value={profile.email}
                    onChange={(event) =>
                      updateProfile(
                        "email",
                        event.target.value
                      )
                    }
                    placeholder="you@example.com"
                  />

                </label>

                {/* Phone */}
                <label>

                  <span>PHONE</span>

                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(event) =>
                      updateProfile(
                        "phone",
                        event.target.value
                      )
                    }
                    placeholder="+91 00000 00000"
                  />

                </label>

                {/* Summary */}
                <label className="full professional-summary">

                  <span>
                    PROFESSIONAL SUMMARY
                  </span>

                  <textarea
                    value={profile.summary}
                    onChange={(event) =>
                      updateProfile(
                        "summary",
                        event.target.value
                      )
                    }
                    placeholder="Write a concise summary that highlights your experience, strengths and career direction."
                    rows={7}
                  />

                  <div className="aiRow">

                    <span>
                      AI can improve clarity and
                      impact without changing your
                      facts.
                    </span>

                    <button
                      type="button"
                      className="aiButton"
                      onClick={improve}
                      disabled={loading}
                    >
                      {loading
                        ? "Improving…"
                        : "✦ Improve with AI"}
                    </button>

                  </div>

                </label>

                {/* Skills */}
                <label className="full skills-field">

                  <span>SKILLS</span>

                  <input
                    value={profile.skills}
                    onChange={(event) =>
                      updateProfile(
                        "skills",
                        event.target.value
                      )
                    }
                    placeholder="React, Node.js, MongoDB, Express"
                  />

                </label>

              </div>

              {/* AI Output */}
              {output && (
                <div className="aiFeedback">

                  <span>AI OUTPUT</span>

                  <p>{output}</p>

                </div>
              )}

            </div>

            {/* Resume Preview */}
            <div className="previewPane">

              <div className="previewHead">

                <div>

                  <span>
                    LIVE PREVIEW
                  </span>

                  <b>Resume</b>

                </div>

                <button
                  type="button"
                  className="previewPrint"
                  onClick={exportPDF}
                >
                  Print
                </button>

              </div>

              <div className="resumePaper">

                {/* Resume Header */}
                <div className="resumeHeader">

                  <div>

                    <h1>
                      {profile.name ||
                        "Your Name"}
                    </h1>

                    <h2>
                      {profile.role ||
                        "Professional"}
                    </h2>

                  </div>

                  <div className="resumeContact">

                    {profile.email && (
                      <span>
                        {profile.email}
                      </span>
                    )}

                    {profile.phone && (
                      <span>
                        {profile.phone}
                      </span>
                    )}

                  </div>

                </div>

                <div className="resumeRule" />

                {/* Profile */}
                <section>

                  <h3>PROFILE</h3>

                  <p>
                    {profile.summary ||
                      "Your professional summary will appear here. Add a concise introduction that explains your experience, strengths and career direction."}
                  </p>

                </section>

                {/* Skills */}
                <section>

                  <h3>SKILLS</h3>

                  <div className="skillTags">

                    {(profile.skills || "")
                      .split(",")
                      .map((skill) =>
                        skill.trim()
                      )
                      .filter(Boolean)
                      .map((skill) => (
                        <span key={skill}>
                          {skill}
                        </span>
                      ))}

                  </div>

                </section>

                {/* Experience */}
                <section className="placeholderSection">

                  <h3>EXPERIENCE</h3>

                  <div>

                    <b>
                      Your experience
                    </b>

                    <small>
                      Add your most relevant role,
                      achievements and impact.
                    </small>

                  </div>

                </section>

                {/* Education */}
                <section className="placeholderSection">

                  <h3>EDUCATION</h3>

                  <div>

                    <b>
                      Your education
                    </b>

                    <small>
                      Add your degree, university
                      and graduation details.
                    </small>

                  </div>

                </section>

              </div>

            </div>

          </div>
        </section>
      )}

      {/* ===================================================
          PROTECTED WORKSPACE
      =================================================== */}

      {page === "workspace" && !user && (
        <section className="content">

          <h1>
            Protected workspace
          </h1>

          <p>
            Please sign in to continue.
          </p>

          <button
            type="button"
            className="primary"
            onClick={() =>
              goToAuth("login")
            }
          >
            Login ↗
          </button>

        </section>
      )}

      {/* ===================================================
          FOOTER
      =================================================== */}

      <footer>

        <b>
          {APP_CONFIG.name}
        </b>

        <span>
          MERN + AI · Sessions · MongoDB ·
          Billing-ready
        </span>

        <span>
          Home · About · Features · Pricing
        </span>

      </footer>

    </div>
  );
}

/* =========================================================
   APPLICATION MOUNT
========================================================= */

const rootElement =
  document.getElementById("root");

if (!rootElement) {
  throw new Error(
    'Root element "#root" was not found. Check your index.html.'
  );
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

