import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "../auth-context";
import { RegisterForm } from "../register-form";
import * as authApi from "@/lib/api/authApi";
import { ApiError } from "@/lib/api/client";

vi.mock("@/lib/api/authApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/authApi")>();
  return { ...actual, login: vi.fn(), register: vi.fn() };
});
const mockedLogin = vi.mocked(authApi.login);
const mockedRegister = vi.mocked(authApi.register);

const push = vi.fn();
let queryString = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(queryString),
}));

function SignedInUser() {
  const { user } = useAuth();
  return <p>Signed in as {user?.displayName ?? "nobody"}</p>;
}

const VALID_PASSWORD = "correct-horse-battery";

beforeEach(() => {
  push.mockClear();
  mockedLogin.mockReset();
  mockedRegister.mockReset();
  window.localStorage.clear();
  queryString = "";
});

function renderForm() {
  render(
    <AuthProvider>
      <RegisterForm />
      <SignedInUser />
    </AuthProvider>,
  );
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<{ displayName: string; email: string; password: string }> = {},
) {
  const values = {
    displayName: "Sam Observer",
    email: "observer@example.org",
    password: VALID_PASSWORD,
    ...overrides,
  };

  if (values.displayName) {
    await user.type(screen.getByLabelText("Display name"), values.displayName);
  }
  if (values.email) {
    await user.type(screen.getByLabelText("Email"), values.email);
  }
  if (values.password) {
    await user.type(screen.getByLabelText("Password"), values.password);
  }
}

describe("Register — submission is disabled for invalid input", () => {
  it("disables the submit button while the password is shorter than 12 characters", async () => {
    renderForm();
    const user = userEvent.setup();
    await fillForm(user, { password: "short" });

    expect(screen.getByRole("button", { name: /create account/i })).toBeDisabled();
  });

  it("disables the submit button when the password has fewer than four distinct characters", async () => {
    renderForm();
    const user = userEvent.setup();
    await fillForm(user, { password: "aaaaaaaaaaaa" });

    expect(screen.getByRole("button", { name: /create account/i })).toBeDisabled();
  });

  it("disables the submit button while a required field is empty", async () => {
    renderForm();
    const user = userEvent.setup();
    await fillForm(user, { displayName: "" });

    expect(screen.getByRole("button", { name: /create account/i })).toBeDisabled();
  });

  it("disables the submit button for a malformed email address", async () => {
    renderForm();
    const user = userEvent.setup();
    await fillForm(user, { email: "not-an-email" });

    expect(screen.getByRole("button", { name: /create account/i })).toBeDisabled();
  });

  it("enables the submit button once every field is valid", async () => {
    renderForm();
    const user = userEvent.setup();
    await fillForm(user);

    expect(screen.getByRole("button", { name: /create account/i })).toBeEnabled();
  });

  it("shows live accessible requirements without displaying a maximum", async () => {
    renderForm();
    const user = userEvent.setup();
    const password = screen.getByLabelText("Password");

    expect(screen.getByText("Required: At least 12 characters")).toBeInTheDocument();
    expect(screen.getByText("Required: At least 4 different characters")).toBeInTheDocument();
    expect(screen.queryByText(/128|maximum/i)).not.toBeInTheDocument();

    await user.type(password, "reefcare1234");

    expect(screen.getByText("Met: At least 12 characters")).toBeInTheDocument();
    expect(screen.getByText("Met: At least 4 different characters")).toBeInTheDocument();
  });

  it("allows the password to be shown and hidden", async () => {
    renderForm();
    const user = userEvent.setup();
    const password = screen.getByLabelText("Password");

    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });
});

describe("Register — no role selection is offered", () => {
  it("renders no role-related control; new accounts are always observer", () => {
    renderForm();

    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

describe("Register — button shows a loading state while submitting", () => {
  it("disables the button and swaps its label during submission", async () => {
    let resolveRegister!: (value: Awaited<ReturnType<typeof authApi.register>>) => void;
    mockedRegister.mockReturnValue(
      new Promise((resolve) => {
        resolveRegister = resolve;
      }),
    );

    renderForm();
    const user = userEvent.setup();
    await fillForm(user);

    const button = screen.getByRole("button", { name: /create account/i });
    await user.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/creating account/i);

    resolveRegister({
      id: 1,
      email: "observer@example.org",
      displayName: "Sam Observer",
      role: "observer",
    });
    mockedLogin.mockResolvedValue({
      accessToken: "tok-abc",
      tokenType: "bearer",
      expiresIn: 3600,
      user: { id: 1, displayName: "Sam Observer", role: "observer" },
    });
    await screen.findByText("Signed in as Sam Observer");
  });
});

describe("Register — success registers the account, then signs the observer in", () => {
  it("calls register() and login() as two separate requests and navigates in", async () => {
    mockedRegister.mockResolvedValue({
      id: 1,
      email: "observer@example.org",
      displayName: "Sam Observer",
      role: "observer",
    });
    mockedLogin.mockResolvedValue({
      accessToken: "tok-abc",
      tokenType: "bearer",
      expiresIn: 3600,
      user: { id: 1, displayName: "Sam Observer", role: "observer" },
    });

    renderForm();
    const user = userEvent.setup();
    await fillForm(user);

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Signed in as Sam Observer")).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/my-reports");

    expect(mockedRegister).toHaveBeenCalledTimes(1);
    expect(mockedLogin).toHaveBeenCalledTimes(1);
    expect(mockedLogin).toHaveBeenCalledWith("observer@example.org", VALID_PASSWORD);

    const registerPayload = mockedRegister.mock.calls[0][0];
    expect(registerPayload).not.toHaveProperty("role");
  });

  it("returns the new observer to their intended reporting flow", async () => {
    queryString = "next=%2Freport-a-reef%3Fsite%3D13";
    mockedRegister.mockResolvedValue({
      id: 1,
      email: "observer@example.org",
      displayName: "Sam Observer",
      role: "observer",
    });
    mockedLogin.mockResolvedValue({
      accessToken: "tok-abc",
      tokenType: "bearer",
      expiresIn: 3600,
      user: { id: 1, displayName: "Sam Observer", role: "observer" },
    });

    renderForm();
    const user = userEvent.setup();
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(push).toHaveBeenCalledWith("/report-a-reef?site=13");
  });
});

describe("Register — failed submission", () => {
  it("replaces validation details with a user-facing correction message", async () => {
    mockedRegister.mockRejectedValue(new ApiError("String should have at least 12 characters", 422));

    renderForm();
    const user = userEvent.setup();
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Some information needs correcting before you can continue.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(/backend|API|String should|422/i);
  });

  it("explains a duplicate email without exposing the response detail", async () => {
    mockedRegister.mockRejectedValue(new ApiError("Database unique constraint failed", 409));

    renderForm();
    const user = userEvent.setup();
    await fillForm(user);

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An account with this email already exists. Try logging in instead.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(/database|constraint|backend|API/i);
    expect(push).not.toHaveBeenCalled();
    expect(mockedLogin).not.toHaveBeenCalled();
  });
});
