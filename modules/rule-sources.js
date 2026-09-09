// The project owner chose the colleague's calculator as the primary rate source.
// Video verification is absent there and keeps the project's existing rules.
export const RULE_SOURCE_POLICY = 'colleague-primary-v1';

export function defaultRulesSource(type) {
  return type === 'video' ? 'our' : 'colleague';
}

export function withColleagueRules(payload) {
  return {
    ...payload,
    config: {
      ...payload.config,
      calculators: {
        ...payload.config.calculators,
        ...payload.config.referenceCalculators
      }
    }
  };
}
