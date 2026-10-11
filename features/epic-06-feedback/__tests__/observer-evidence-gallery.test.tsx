import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ObserverEvidenceGallery } from "../observer-evidence-gallery";
import { getObserverEvidence } from "@/lib/api/reportsApi";
import { ApiError } from "@/lib/api/client";

vi.mock("@/lib/api/reportsApi");
const getEvidence = vi.mocked(getObserverEvidence);
const image = () => new Blob(["photo"], { type: "image/jpeg" });

beforeEach(() => {
  getEvidence.mockReset();
  getEvidence.mockResolvedValue(image());
  let nextUrl = 0;
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => `blob:submitted-${++nextUrl}`) });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function(this: HTMLDialogElement) {
    this.open = true; this.querySelector<HTMLButtonElement>("button")?.focus();
  } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function(this: HTMLDialogElement) { this.open = false; } });
});

describe("Observer submitted evidence", () => {
  it("loads original and additional-reply photos only through the Observer evidence route", async () => {
    const evidence = [
      { evidenceId: 101, mediaType: "photo", storageKey: "PRIVATE-KEY", responsibleTeam: "PRIVATE-TEAM" },
      { evidenceId: 102, mediaType: "photo" },
      { evidenceId: 103, mediaType: "photo" },
    ];
    render(<ObserverEvidenceGallery reportReference="RC-0241" evidence={evidence} />);
    await screen.findByRole("button", { name: "View submitted photo 3" });
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.getByText("3 photos")).toBeInTheDocument();
    for (const id of [101, 102, 103]) expect(getEvidence).toHaveBeenCalledWith("RC-0241", id, expect.any(AbortSignal));
    expect(screen.queryByText(/PRIVATE/)).not.toBeInTheDocument();
    expect(document.querySelector('img[src*="PRIVATE"]')).toBeNull();
  });

  it("opens the loaded image without another request and restores focus after closing", async () => {
    render(<ObserverEvidenceGallery reportReference="RC-0241" evidence={[{ evidenceId: 101, mediaType: "photo" }]} />);
    const thumbnail = await screen.findByRole("button", { name: "View submitted photo 1" });
    thumbnail.focus(); fireEvent.click(thumbnail);
    const dialog = screen.getByRole("dialog", { name: "Submitted photo 1" });
    expect(within(dialog).getByRole("img")).toHaveAttribute("src", "blob:submitted-1");
    expect(getEvidence).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Close photo" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(thumbnail).toHaveFocus();
    fireEvent.click(thumbnail);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false, cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("deduplicates IDs and ignores non-photo or invalid metadata", async () => {
    render(<ObserverEvidenceGallery reportReference="RC-0241" evidence={[
      { evidenceId: 101, mediaType: "photo" }, { evidenceId: 101, mediaType: "photo" },
      { evidenceId: 102, mediaType: "video" }, { evidenceId: -1, mediaType: "photo" },
    ]} />);
    await screen.findByRole("img");
    expect(getEvidence).toHaveBeenCalledTimes(1);
    expect(screen.getByText("1 photo")).toBeInTheDocument();
  });

  it("shows an empty state without inventing image IDs", () => {
    const { rerender } = render(<ObserverEvidenceGallery reportReference="RC-0241" evidence={[]} />);
    expect(screen.getByText("No photos were attached to this report.")).toBeInTheDocument();
    rerender(<ObserverEvidenceGallery reportReference="RC-0241" evidenceCount={2} />);
    expect(screen.getByText(/Refresh the report/)).toBeInTheDocument();
    expect(getEvidence).not.toHaveBeenCalled();
  });

  it("isolates a failed photo and retries without hiding the rest of the report", async () => {
    getEvidence.mockRejectedValueOnce(new ApiError("PRIVATE DATABASE FAILURE", 500));
    render(<ObserverEvidenceGallery reportReference="RC-0241" evidence={[
      { evidenceId: 101, mediaType: "photo" }, { evidenceId: 102, mediaType: "photo" },
    ]} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This photo could not be loaded.");
    expect(await screen.findByRole("button", { name: "View submitted photo 2" })).toBeInTheDocument();
    expect(screen.queryByText(/PRIVATE/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry photo 1" }));
    expect(await screen.findByRole("button", { name: "View submitted photo 1" })).toBeInTheDocument();
    expect(getEvidence).toHaveBeenCalledTimes(3);
  });

  it.each([403, 404])("handles unavailable evidence (%s) without exposing server details", async (status) => {
    getEvidence.mockRejectedValueOnce(new ApiError("PRIVATE STORAGE KEY", status));
    render(<ObserverEvidenceGallery reportReference="RC-0241" evidence={[{ evidenceId: 101, mediaType: "photo" }]} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This photo is unavailable.");
    expect(screen.queryByText(/PRIVATE/)).not.toBeInTheDocument();
  });

  it("rejects non-image bytes returned with HTTP 200", async () => {
    getEvidence.mockResolvedValueOnce(new Blob(["PRIVATE JSON"], { type: "application/json" }));
    render(<ObserverEvidenceGallery reportReference="RC-0241" evidence={[{ evidenceId: 101, mediaType: "photo" }]} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This photo could not be loaded.");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("revokes loaded blob URLs and aborts requests when leaving the report", async () => {
    const { unmount } = render(<ObserverEvidenceGallery reportReference="RC-0241" evidence={[{ evidenceId: 101, mediaType: "photo" }]} />);
    await screen.findByRole("img");
    const signal = getEvidence.mock.calls[0][2];
    unmount();
    expect(signal?.aborted).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:submitted-1");
  });

  it("does not create a blob URL when a late request finishes after unmounting", async () => {
    let resolve!: (blob: Blob) => void;
    getEvidence.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const { unmount } = render(<ObserverEvidenceGallery reportReference="RC-0241" evidence={[{ evidenceId: 101, mediaType: "photo" }]} />);
    unmount();
    await act(async () => resolve(image()));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("loads the next report independently and releases the previous photo", async () => {
    const { rerender } = render(<ObserverEvidenceGallery reportReference="RC-0241" evidence={[{ evidenceId: 101, mediaType: "photo" }]} />);
    await screen.findByRole("img");
    rerender(<ObserverEvidenceGallery reportReference="RC-0242" evidence={[{ evidenceId: 101, mediaType: "photo" }]} />);
    await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "blob:submitted-2"));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:submitted-1");
    expect(getEvidence).toHaveBeenLastCalledWith("RC-0242", 101, expect.any(AbortSignal));
  });
});
