import type { Metadata } from "next";
import Game from "./Game.tsx";
import "./play.css";

export const metadata: Metadata = {
  title: "The Intelligence Age — Simulation",
  description:
    "Govern a country through the AI transition. A simulation where policies take years to bite, blocs change size as your decisions reshape the economy, and you have to keep winning elections while doing the parts nobody thanks you for.",
};

export default function PlayPage() {
  return <Game />;
}
