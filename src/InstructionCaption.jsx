// shared by the instruction views (ask > instruction, navigate, generate)
export default function InstructionCaption() {
  return (
    <p className="caption">
      Real LLMs attend to the whole context and handle negation far better than an averaged bag of words, but an
      instruction still only shifts probabilities; it cannot guarantee the output
      (see <a href="https://arxiv.org/abs/2311.07911" target="_blank" rel="noopener">IFEval</a>, Zhou et al., 2023).
    </p>
  );
}
