import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "@/features/epic-01-access/auth-context";
import { ThreatExplorer } from "../threat-explorer";
import { spotTheThreatExamples, threatExplorerItems } from "../threat-explorer-data";

function renderExplorer() {
  return render(
    <AuthProvider>
      <ThreatExplorer />
    </AuthProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});

describe("Epic 3 Reef Threat Explorer", () => {
  it("introduces all four supported threats without requiring input", () => {
    renderExplorer();

    expect(screen.getByRole("heading", { name: /explore a threat/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^explore /i })).toHaveLength(4);
    expect(screen.getByText(/lost or abandoned nets/i)).toBeInTheDocument();
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
  });

  it("moves between threats with card and carousel controls", async () => {
    const user = userEvent.setup();
    renderExplorer();

    await user.click(screen.getByRole("button", { name: "Explore Coral bleaching" }));
    expect(screen.getByRole("heading", { name: "Coral bleaching" })).toBeInTheDocument();
    expect(screen.getByText("2 of 4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next threat" }));
    expect(screen.getByRole("heading", { name: "Marine debris" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous threat" }));
    expect(screen.getByRole("heading", { name: "Coral bleaching" })).toBeInTheDocument();
  });

  it("opens a threat selected by a Reef Threats link", () => {
    render(
      <AuthProvider>
        <ThreatExplorer initialThreat="marine_debris" />
      </AuthProvider>,
    );

    expect(screen.getByRole("heading", { name: "Marine debris" })).toBeInTheDocument();
    expect(screen.getByText("3 of 4")).toBeInTheDocument();
  });

  it("updates the selected threat details after choosing a card", async () => {
    const user = userEvent.setup();
    renderExplorer();

    await user.click(screen.getByRole("button", { name: "Explore Coral bleaching" }));

    expect(screen.getByRole("region", { name: "Coral bleaching" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explore Coral bleaching" })).toHaveAttribute("aria-pressed", "true");
  });

  it("asks a Spot the Threat question before revealing any clue", () => {
    renderExplorer();

    expect(screen.getByRole("heading", { name: "Spot the threat" })).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Which threat does this image show?" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Answer options" })).getAllByRole("button")).toHaveLength(4);
    expect(screen.getByRole("status")).toHaveTextContent(/tap the threat you think this image shows/i);
    expect(screen.getByRole("status")).not.toHaveTextContent(/notice the colour/i);
    expect(screen.getByAltText(/white branching coral colony next to a brown/i)).toBeInTheDocument();
    expect(screen.queryByAltText(/bleached/i)).not.toBeInTheDocument();
  });

  it("confirms a right answer and explains the visual cue", async () => {
    const user = userEvent.setup();
    renderExplorer();
    const options = screen.getByRole("group", { name: "Answer options" });

    await user.click(within(options).getByRole("button", { name: /^Coral bleaching/ }));

    expect(screen.getByRole("status")).toHaveTextContent("Correct: Coral bleaching");
    expect(screen.getByRole("status")).toHaveTextContent(/notice the colour/i);
    expect(screen.getByRole("status")).toHaveTextContent(/intact branching shape/i);
    expect(within(options).getByRole("button", { name: /^Coral bleaching.*your answer, correct/i })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByAltText(/bleached coral/i)).toBeInTheDocument();

    await user.click(within(options).getByRole("button", { name: /^Marine debris/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Correct: Coral bleaching");
  });

  it("explains why a wrong answer does not fit, then shows the right one", async () => {
    const user = userEvent.setup();
    renderExplorer();
    const options = screen.getByRole("group", { name: "Answer options" });

    await user.click(within(options).getByRole("button", { name: /^Physical reef damage/ }));

    expect(screen.getByRole("status")).toHaveTextContent("Not quite. This is Coral bleaching.");
    expect(screen.getByRole("status")).toHaveTextContent(/pale branches are whole and still attached/i);
    expect(screen.getByRole("status")).toHaveTextContent(/intact branching shape/i);
    expect(within(options).getByRole("button", { name: /^Physical reef damage.*your answer/i })).toBeInTheDocument();
    expect(within(options).getByRole("button", { name: /^Coral bleaching.*correct answer/i })).toBeInTheDocument();
  });

  it("scores a full round and lets the visitor try again", async () => {
    const user = userEvent.setup();
    renderExplorer();
    const answers = ["Coral bleaching", "Coral bleaching", "Ghost fishing gear", "Marine debris"];

    for (const [index, answer] of answers.entries()) {
      expect(screen.getByText(`Question ${index + 1} of 4`)).toBeInTheDocument();
      await user.click(within(screen.getByRole("group", { name: "Answer options" })).getByRole("button", { name: new RegExp(`^${answer}`) }));
      await user.click(screen.getByRole("button", { name: index === 3 ? /see your score/i : /next question/i }));
    }

    const score = screen.getByRole("heading", { name: "You spotted 3 of 4" });
    expect(score).toHaveFocus();

    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByText("Question 1 of 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Which threat does this image show?" })).toHaveFocus();
  });

  it("gives every Spot the Threat question a note for each wrong answer", () => {
    const codes = threatExplorerItems.map((threat) => threat.code);

    expect(spotTheThreatExamples.map((example) => example.threatCode).sort()).toEqual([...codes].sort());
    for (const example of spotTheThreatExamples) {
      const wrongCodes = codes.filter((code) => code !== example.threatCode);
      expect(Object.keys(example.wrongAnswerNotes).sort()).toEqual(wrongCodes.sort());
      expect(Object.values(example.wrongAnswerNotes).every((note) => note && note.length > 20)).toBe(true);
    }
  });

  it("routes a public visitor through login while preserving the selected threat", async () => {
    const user = userEvent.setup();
    renderExplorer();

    await user.click(screen.getByRole("button", { name: "Explore Physical reef damage" }));
    expect(await screen.findByRole("link", { name: "Report this threat" })).toHaveAttribute(
      "href",
      "/login?next=%2Freport-a-reef%3Fthreat%3Dphysical_damage",
    );
    expect(screen.getByRole("link", { name: "I’m not sure what I saw" })).toHaveAttribute(
      "href",
      "/login?next=%2Freport-a-reef%3Fthreat%3Dunsure",
    );
  });

  it("shows more than one example image for every supported threat", async () => {
    const user = userEvent.setup();
    renderExplorer();

    for (const label of ["Ghost fishing gear", "Coral bleaching", "Marine debris", "Physical reef damage"]) {
      await user.click(screen.getByRole("button", { name: `Explore ${label}` }));
      const gallery = screen.getByLabelText(`${label} visual examples`);

      expect(gallery.querySelectorAll("img").length).toBeGreaterThan(1);
    }
  });

  it("tells the visitor what may be useful to record", async () => {
    const user = userEvent.setup();
    renderExplorer();

    expect(screen.getByText("What to record")).toBeInTheDocument();
    expect(screen.getByLabelText(/what to record for ghost fishing gear/i)).toHaveTextContent(/whether any animal is trapped/i);

    await user.click(screen.getByRole("button", { name: "Explore Coral bleaching" }));
    expect(screen.getByLabelText(/what to record for coral bleaching/i)).toHaveTextContent(/how much of the area is affected/i);
  });

  it("shows two ghost fishing gear examples instead of a healthy-reef comparison", () => {
    renderExplorer();

    const gallery = screen.getByLabelText("Ghost fishing gear visual examples");
    expect(within(gallery).getByText("Trained divers removing a lost net")).toBeInTheDocument();
    expect(within(gallery).getByText("Sea turtle caught in a lost net")).toBeInTheDocument();
    expect(within(gallery).queryByText(/for comparison/i)).not.toBeInTheDocument();
  });

  it("compares bleached coral with normally coloured colonies", async () => {
    const user = userEvent.setup();
    renderExplorer();

    await user.click(screen.getByRole("button", { name: "Explore Coral bleaching" }));

    expect(screen.getByText("A bleached branching reef")).toBeInTheDocument();
    expect(screen.getByText("Healthy branching reef for comparison")).toBeInTheDocument();
  });

  it("states that the education is recognition guidance rather than a diagnosis", () => {
    renderExplorer();

    expect(screen.getByText(/not a scientific identification or confirmation of any specific observation/i)).toBeInTheDocument();
  });

  it("credits the real photographs and marks the quiz images as illustrations", async () => {
    const user = userEvent.setup();
    renderExplorer();

    await user.click(screen.getByText("Image sources"));

    expect(screen.getByText(/photographs are real recognition examples/i)).toBeInTheDocument();
    expect(screen.getByText(/images are illustrations generated for reefcare/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tim Sheerman-Chase" })).toHaveAttribute("href", expect.stringContaining("commons.wikimedia.org"));
    expect(screen.getByText("Illustration")).toBeInTheDocument();
  });
});
