import type { AccountMessages } from '../AccountPanel';

// The texts of the Direction D access and registration cards: the `account.auth` namespace of
// the dictionaries (13.2). The cards also read the older `account.access` / `account.register`
// leaves they share with the rest of the page. Placeholders: `{email}`, `{time}` (m:ss),
// `{n}` / `{total}` (numbers), `{provider}` (Discord, Google or Twitch, never translated),
// `{name}` (the name at the provider), `{days}` (DISCORD_EDAD_MIN_DIAS), `{username}`.

export interface AuthTexts {
  signInTitle: string;
  signInText: string;
  noAccount: string;
  haveAccount: string;
  showPassword: string;
  expiredTitle: string;
  expiredText: string;
  forgotTitle: string;
  forgotText: string;
  sendLink: string;
  remembered: string;
  checkTitle: string;
  checkText: string;
  spamHint: string;
  resendLinkIn: string;
  resendLink: string;
  backToSignIn: string;
  resetTitle: string;
  resetFor: string;
  repeatPassword: string;
  passwordLength: string;
  mismatch: string;
  saveAndEnter: string;
  linkExpiredLead: string;
  linkExpiredText: string;
  requestAnother: string;
  signUpTitle: string;
  signUpText: string;
  emailHelp: string;
  stepIdentity: string;
  stepsAt: string;
  stepsDone: string;
  stepDone: string;
  confirmTitle: string;
  codeSentTo: string;
  changeEmail: string;
  resendIn: string;
  codeSpam: string;
  confirm: string;
  codeInvalid: string;
  confirmedTitle: string;
  confirmedText: string;
  continue: string;
  confirmedElsewhereLead: string;
  confirmedElsewhereText: string;
  linkUsedLead: string;
  linkUsedText: string;
  identityTitle: string;
  identityText: string;
  continueGoogle: string;
  discordHint: string;
  or: string;
  linked: string;
  linkedAs: string;
  remove: string;
  addLater: string;
  linkingTitle: string;
  linkingText: string;
  slowLead: string;
  slowText: string;
  backToStep: string;
  takenLead: string;
  takenText: string;
  cancelledLead: string;
  cancelledText: string;
  providerDownLead: string;
  providerDownText: string;
  profileTitle: string;
  profileText: string;
  day: string;
  month: string;
  year: string;
  doneTitle: string;
  doneText: string;
  doneDiscord: string;
  link: string;
  backToWiki: string;
  toAccount: string;
}

/** `account.auth` of the page's dictionary. */
export function authTexts(messages: AccountMessages): AuthTexts {
  return (messages as AccountMessages & { auth: AuthTexts }).auth;
}

/** Provider names are brands: the same in every language. */
export const PROVIDER_NAME = { discord: 'Discord', google: 'Google', twitch: 'Twitch' } as const;
