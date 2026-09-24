// The one door between the account page and the access and registration flow (track AUTH):
// sign in, the recovery password, the steps of 9.15.1, «Listo», the return notices, the profile
// form, the phone and the identity links. The page imports this module only dynamically, so the
// flow is a chunk of its own and stays out of the initial JS of `/{l}/cuenta/` (13.6). When the
// flow moves, only these lines change.
export {
  AccessForm,
  AuthReturnNotice,
  NewPasswordForm,
  PhoneVerification,
  ProfileForm,
  RegistrationDone,
  RegistrationSteps,
  linkProvider,
  takeLinkingProvider,
} from '../RegistrationSteps';
