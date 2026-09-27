// Test Library's waitFor / findBy* give up after 1s by default, which a slow CI machine can
// exceed while lazily loading a corpus. It's a ceiling, not a delay: passing checks return at once.
import {configure} from '@testing-library/react';

configure({asyncUtilTimeout: 10_000});
