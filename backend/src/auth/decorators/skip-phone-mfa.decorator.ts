import { SetMetadata } from '@nestjs/common';

export const SKIP_PHONE_MFA_KEY = 'skipPhoneMfa';

/** Allow an authenticated route before the text-message code is entered. */
export const SkipPhoneMfa = () => SetMetadata(SKIP_PHONE_MFA_KEY, true);
