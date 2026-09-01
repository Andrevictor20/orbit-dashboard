import '@testing-library/jest-dom';
import i18n from '../i18n';
import { setI18n } from 'react-i18next';

setI18n(i18n);
i18n.changeLanguage('pt');

class MockEventSource { addEventListener() {} close() {} } globalThis.EventSource = MockEventSource as any;
