import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { DisplayDateInput } from "../display-date-input";
import { todayInputDateValue } from "@/lib/format/date";

function TestInput() {
  const [value, setValue] = useState("");
  return <DisplayDateInput label="Observation date" value={value} onChange={setValue} />;
}

function IsoDateInput() {
  const [value, setValue] = useState("2026-11-10");
  return <><DisplayDateInput label="From" valueFormat="iso" value={value} onChange={setValue} allowFuture required /><output aria-label="API date">{value}</output><button onClick={() => setValue("2026-12-01")}>Load another date</button></>;
}

function FutureDateInput() {
  const [value, setValue] = useState("");
  return <DisplayDateInput label="Planned action date" value={value} onChange={setValue} allowFuture />;
}

describe("DisplayDateInput", () => {
  it("formats numeric typing as dd/mm/yyyy", async () => {
    const user = userEvent.setup();
    render(<TestInput />);

    const input = screen.getByLabelText("Observation date, format dd/mm/yyyy");
    await user.type(input, "05092026");

    expect(input).toHaveValue("05/09/2026");
  });

  it("prevents the native calendar from selecting a future date", () => {
    const { container } = render(<TestInput />);
    const picker = container.querySelector('input[type="date"]');

    expect(picker).toHaveAttribute("max", todayInputDateValue());
  });

  it("allows the native calendar to select a future planned date when requested", () => {
    const { container } = render(<FutureDateInput />);
    const picker = container.querySelector('input[type="date"]');

    expect(picker).not.toHaveAttribute("max");
  });
  it("shows DD/MM/YYYY for ISO callers and keeps partial typing before emitting a valid ISO date", async () => {
    const user = userEvent.setup();
    render(<IsoDateInput />);
    const input = screen.getByLabelText("From, format dd/mm/yyyy");
    expect(input).toHaveValue("10/11/2026");
    await user.clear(input);
    await user.type(input, "05122026");
    expect(input).toHaveValue("05/12/2026");
    expect(screen.getByLabelText("API date")).toHaveTextContent("2026-12-05");
    await user.click(screen.getByRole("button", { name: "Load another date" }));
    expect(input).toHaveValue("01/12/2026");
  });

  it("converts native calendar choices to DD/MM/YYYY without changing the API value", () => {
    const { container } = render(<IsoDateInput />);
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: "2026-12-31" } });
    expect(screen.getByLabelText("From, format dd/mm/yyyy")).toHaveValue("31/12/2026");
    expect(screen.getByLabelText("API date")).toHaveTextContent("2026-12-31");
  });

  it("blocks impossible typed dates and permits correction", () => {
    render(<IsoDateInput />);
    const input = screen.getByLabelText("From, format dd/mm/yyyy");
    fireEvent.change(input, { target: { value: "31022026" } });
    expect(input).toHaveValue("31/02/2026");
    expect(input).toBeInvalid();
    fireEvent.change(input, { target: { value: "28022026" } });
    expect(input).toBeValid();
    expect(screen.getByLabelText("API date")).toHaveTextContent("2026-02-28");
  });

  it("retains an explicit calendar maximum and checks typed values against it", () => {
    function BoundedInput() {
      const [value, setValue] = useState("");
      return <DisplayDateInput label="Actual date" value={value} onChange={setValue} maxDate="2026-09-10" />;
    }
    const { container } = render(<BoundedInput />);
    expect(container.querySelector('input[type="date"]')).toHaveAttribute("max", "2026-09-10");
    const input = screen.getByLabelText("Actual date, format dd/mm/yyyy");
    fireEvent.change(input, { target: { value: "11092026" } });
    expect(input).toBeInvalid();
    fireEvent.change(input, { target: { value: "10092026" } });
    expect(input).toBeValid();
  });
});
