const EXPLANATION_EXAMPLES = [
  'Forma, what is the cusp of Carabelli?',
  'Forma, what is torque?',
  'Forma, explain tipping',
  'Forma, start the tooth anatomy tour',
  'Forma, next',
  'Forma, explain this step',
  'Forma, close the definition',
  'Forma, end the tooth tour',
];

/** Shared discovery copy in the Guide and Library; the opening controls stay unchanged. */
export function AskFormaExamples() {
  return (
    <section aria-label="Ask Forma">
      <h3>Ask Forma</h3>
      <p className="form-note">
        Ask for a short definition with a model view, or walk through the tooth anatomy tour. These
        authored explanations work locally without the AI service. Type the same phrases in the
        command bar; browser voice recognition may require a connection.
      </p>
      <ul>
        {EXPLANATION_EXAMPLES.map(phrase => (
          <li key={phrase}>{phrase}</li>
        ))}
      </ul>
      <p className="form-note">
        During the tour, Next or your clicker advances the lesson; “next side” turns the tooth. End
        the tour to return to the full mouth. Teaching draft — pending educator review · synthetic
        model.
      </p>
    </section>
  );
}
