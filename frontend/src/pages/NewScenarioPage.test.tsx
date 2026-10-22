import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { draftScenario } from "../api";
import { NewScenarioPage } from "./NewScenarioPage";

vi.mock("../api", () => ({
  draftScenario: vi.fn(),
  createScenario: vi.fn(),
}));

const mockedDraft = vi.mocked(draftScenario);

const draft = {
  title: "Missed deadline",
  config: {
    persona: "Arjun, an analyst",
    user_role: "Team manager",
    context: "The report went out late.",
    objectives: ["Understand the delay"],
    stopping_conditions: ["A plan is agreed"],
  },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <NewScenarioPage />
    </MemoryRouter>,
  );
}

function fillAnswers() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Missed deadline" } });
  fireEvent.change(screen.getByLabelText("You are"), { target: { value: "Team manager" } });
  fireEvent.change(screen.getByLabelText("AI Character"), { target: { value: "Analyst who was late" } });
  fireEvent.change(screen.getByLabelText("Scenario"), { target: { value: "The report went out a day late." } });
  fireEvent.change(screen.getByLabelText("What you want to achieve"), { target: { value: "Understand the delay" } });
}

beforeEach(() => {
  mockedDraft.mockReset();
  mockedDraft.mockResolvedValue(draft);
});

afterEach(() => {
  cleanup();
});

describe("NewScenarioPage", () => {
  it("hides the answers once the scenario is written and shows only the result", async () => {
    renderPage();
    fillAnswers();

    fireEvent.click(screen.getByRole("button", { name: "Create scenario" }));

    expect(await screen.findByRole("heading", { name: "Review the scenario" })).toBeTruthy();
    expect(screen.queryByLabelText("What you want to achieve")).toBeNull();
    expect(screen.queryByRole("button", { name: "Create scenario" })).toBeNull();
    expect(screen.getByLabelText("Ends when")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update the scenario" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save scenario" })).toBeTruthy();
  });

  it("returns to empty answers when the person starts over", async () => {
    renderPage();
    fillAnswers();
    fireEvent.click(screen.getByRole("button", { name: "Create scenario" }));
    await screen.findByRole("heading", { name: "Review the scenario" });

    fireEvent.click(screen.getByRole("button", { name: "Start over" }));

    const name = screen.getByLabelText("Name") as HTMLInputElement;
    expect(name.value).toBe("");
    expect(screen.queryByRole("heading", { name: "Review the scenario" })).toBeNull();
  });

  it("updates the written scenario from feedback without showing the answers again", async () => {
    renderPage();
    fillAnswers();
    fireEvent.click(screen.getByRole("button", { name: "Create scenario" }));
    await screen.findByRole("heading", { name: "Review the scenario" });

    fireEvent.change(screen.getByLabelText("Want something different?"), {
      target: { value: "make the character more defensive" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update the scenario" }));

    await waitFor(() => expect(mockedDraft).toHaveBeenCalledTimes(2));
    expect(mockedDraft.mock.calls[1][0].feedback).toBe("make the character more defensive");
    expect(screen.queryByLabelText("What you want to achieve")).toBeNull();
  });
});
