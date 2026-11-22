import { type FormEvent, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCheckLink } from '@workspace/api-client-react';
import type {
  LinkCheckResult,
  LinkCheckResultAssessment,
} from '@workspace/api-client-react';
import { ArrowLeft, ArrowRight, CircleAlert, ClipboardCheck, ShieldCheck, Sparkles } from 'lucide-react';

type Language = 'ar' | 'en';
type DemoId = 'suspicious' | 'directory' | 'insufficient';
type ResultView = { kind: 'live'; result: LinkCheckResult } | { kind: 'demo'; id: DemoId };
const queryClient = new QueryClient();

const copy = {
  ar: {
    language: 'English',
    eyebrow: 'مراجعة هادئة قبل النقر',
    headlineA: 'توقّف لحظة.',
    headlineB: 'افحص الرابط',
    headlineC: 'قبل أن تفتحه.',
    intro: 'إذا وصلك رابط يثير الشك، ضعه هنا. نراجع شكله وكلمات الرسالة من دون فتحه.',
    trust: 'لن نزور الرابط أو نحمّل محتواه. الفحص يقرأ النص فقط، ولا يضمن أن الرابط آمن.',
    cardTitle: 'ابدأ بفحص الرابط',
    cardSub: 'لا تفتح الرابط لتنسخه؛ انسخه من الرسالة والصقه هنا.',
    urlLabel: 'الصق الرابط هنا',
    urlHint: 'يمكنك لصق الرابط كما وصلك، حتى لو بدا غريباً.',
    messageLabel: 'نص الرسالة الاختياري',
    messageHint: 'أضف الرسالة المحيطة بالرابط إن رغبت. لا تضع كلمات مرور أو بيانات خاصة.',
    submit: 'افحص الآن',
    loading: 'نراجع النص فقط… لن نفتح الرابط',
    error: 'تعذّر إكمال الفحص الآن. تحقّق من اتصالك ثم حاول مرة أخرى.',
    demoTitle: 'جرّب أمثلة توضيحية',
    demoCopy: 'هذه أمثلة مصطنعة على نطاقات ‎.example المحجوزة. النتائج أدناه تجريبية وليست فحصاً حقيقياً.',
    demoSuspicious: 'رابط يحمل مؤشرات مريبة',
    demoDirectory: 'تطابق في دليل جهة خيالية',
    demoInsufficient: 'معلومات غير كافية',
    demoMatched: 'تطابق توضيحي في دليل خيالي',
    demoBadge: 'تجربة توضيحية فقط',
    howTitle: 'ماذا يحدث للرابط؟',
    howCopy: 'تريّا يراجع <strong>نص الرابط والرسالة فقط</strong> بحثاً عن مؤشرات واضحة، مثل كلمات الاستعجال أو طلب كلمة المرور أو عنوان مختصر. لا يفتح الرابط ولا يتحقق من محتوى الموقع. لذلك، غياب المؤشرات لا يعني أن الرابط آمن.',
    officialNote: 'إذا لم يظهر تطابق أو لم تتوفر معلومات كافية، تواصل مع الجهة عبر قناة رسمية تعثر عليها بشكل مستقل — لا تستخدم بيانات التواصل الموجودة في الرسالة المشكوك فيها.',
    footer: 'فكّر قبل أن تنقر.',
    footerSub: 'أداة مساعدة، وليست ضماناً للسلامة.',
    liveLabel: 'نتيجة الفحص',
    suspicious: 'توجد مؤشرات تستدعي الحذر',
    insufficient: 'لم تتوفر معلومات كافية',
    assessment: {
      suspicious: 'توجد مؤشرات تستدعي الحذر',
      official_domain_match: 'النطاق مدرج للجهة، لكن ذلك لا يثبت سلامة الرابط',
      unverified: 'هذا النطاق غير موثّق في الدليل الحالي',
    },
    host: 'النطاق الذي جرى فحصه',
    reasons: 'لماذا ظهرت هذه النتيجة؟',
    next: 'الخطوة الأكثر أماناً',
    directoryTitle: 'مطابقة دليل الجهات الموثّقة',
    verifiedOn: 'تاريخ التحقق',
    sourceLabel: 'مصدر التحقق',
    matchSafetyNotice: 'مطابقة النطاق لا تعني أن الرابط أو الرسالة آمنان.',
    disclaimer: 'الفحص يراجع النص فقط ولا يفتح الرابط. هذه النتيجة ليست ضماناً لسلامة الرابط أو خطورته.',
    checkAgain: 'افحص رابطاً آخر',
    demoOnly: 'هذه نتيجة توضيحية مصطنعة — لم يُجرَ أي فحص مباشر لهذا الرابط.',
    reason: {
      embedded_credentials: 'يحتوي عنوان الرابط على بيانات دخول مضمّنة.',
      punycode_host: 'اسم النطاق يستخدم ترميزاً قد يخفي أحرفاً متشابهة.',
      ip_address_host: 'الرابط يستخدم عنوان IP بدلاً من اسم نطاق مألوف.',
      url_shortener: 'الرابط مختصر، لذلك لا يظهر العنوان النهائي هنا.',
      insecure_http: 'يستخدم الرابط اتصال HTTP غير المشفّر.',
      pressure_words: 'تتضمن الرسالة كلمات تضغط لاتخاذ إجراء سريع.',
      password_request: 'تطلب الرسالة كلمة مرور أو بيانات تسجيل دخول.',
      official_domain_match: 'يطابق النطاق دليلاً موثّقاً لجهة رسمية، لكن ذلك لا يثبت سلامة الرابط أو الرسالة.',
      domain_unverified: 'لم يظهر النطاق ضمن دليل الجهات الموثّقة الحالي.',
      reserved_example_domain: 'النطاق محجوز للأمثلة ولا يمثل جهة حقيقية.',
      no_clear_indicators: 'لم تظهر في النص مؤشرات خطر واضحة؛ هذا لا يثبت أن الرابط آمن.',
    },
    nextStep: {
      do_not_open: 'لا تفتح الرابط. احذف الرسالة أو أبلغ عنها إذا لم تكن تتوقعها.',
      verify_official_channel: 'تحقّق من الجهة عبر موقعها أو رقمها الرسمي الذي تبحث عنه بنفسك.',
      contact_sender: 'اسأل المرسل عبر وسيلة تواصل تعرفها مسبقاً قبل المتابعة.',
    },
    demoReasons: {
      suspicious: 'تجمع الرسالة بين الاستعجال وطلب كلمة المرور، وهما مؤشّران يستحقان الحذر في هذا المثال المصطنع.',
      directory: 'في هذا المثال الخيالي، يظهر اسم النطاق ضمن دليل تجريبي لمنظمة غير حقيقية. لا توجد قاعدة بيانات فعلية وراء هذه النتيجة.',
      insufficient: 'لا يقدم المثال معلومات موثوقة كافية لتحديد الجهة أو سياق الرابط.',
    },
    demoNext: {
      suspicious: 'لا تفتح الرابط ولا تدخل كلمة مرور. تحقّق من حسابك عبر الموقع الرسمي الذي تكتبه أو تبحث عنه بنفسك.',
      directory: 'حتى عند ظهور تطابق توضيحي، تأكد من الجهة عبر قناة رسمية مستقلة قبل مشاركة أي معلومات.',
      insufficient: 'ابحث عن وسيلة تواصل رسمية للجهة بشكل مستقل، واسأل المرسل إن كان الرابط متوقعاً.',
    },
  },
  en: {
    language: 'العربية',
    eyebrow: 'A quiet check before you tap',
    headlineA: 'Pause a moment.',
    headlineB: 'Check the link',
    headlineC: 'before opening it.',
    intro: 'If a link feels off, bring it here. We review its shape and the message around it without opening it.',
    trust: 'We never visit the link or load its contents. This review reads text only and cannot guarantee safety.',
    cardTitle: 'Check a link',
    cardSub: 'Copy the link from the message and paste it here. You do not need to open it.',
    urlLabel: 'Paste the link here',
    urlHint: 'Paste the link as you received it, even if it looks unusual.',
    messageLabel: 'Optional message text',
    messageHint: 'Optionally add the message around the link. Do not include passwords or private details.',
    submit: 'Check now',
    loading: 'Reviewing text only… the link will not be opened',
    error: 'The check could not be completed. Check your connection and try again.',
    demoTitle: 'Try a few demonstrations',
    demoCopy: 'These are fabricated examples on reserved .example domains. Their results are demonstrations, never a live check.',
    demoSuspicious: 'A link with warning signs',
    demoDirectory: 'A match in a fictional directory',
    demoInsufficient: 'Not enough information',
    demoMatched: 'A demonstration match in a fictional directory',
    demoBadge: 'DEMONSTRATION ONLY',
    howTitle: 'What happens to a link?',
    howCopy: 'Tarraya reviews <strong>the link text and message only</strong> for clear signals, such as pressure words, password requests, or shortened addresses. It does not open the link or check what a website contains. No visible warning signs does not mean a link is safe.',
    officialNote: 'If there is no match or there is not enough information, contact the organisation through an official channel you find independently — not through details in the suspicious message.',
    footer: 'Think before you tap.',
    footerSub: 'A helpful check, not a safety guarantee.',
    liveLabel: 'Assessment',
    suspicious: 'Signs call for caution',
    insufficient: 'Not enough information',
    assessment: {
      suspicious: 'Signs call for caution',
      official_domain_match: 'Domain listed for this organisation — not a safety guarantee',
      unverified: 'This domain is not verified in the current directory',
    },
    host: 'Host reviewed',
    reasons: 'Why this result?',
    next: 'A safer next step',
    directoryTitle: 'Verified directory match',
    verifiedOn: 'Date verified',
    sourceLabel: 'Verification source',
    matchSafetyNotice: 'A domain match does not mean the link or message is safe.',
    disclaimer: 'This check reviews text only and does not open the link. It is not a guarantee that a link is safe or unsafe.',
    checkAgain: 'Check another link',
    demoOnly: 'This is a fabricated demonstration result — no live check was made for this link.',
    reason: {
      embedded_credentials: 'The link contains embedded login details.',
      punycode_host: 'The host uses encoding that can disguise similar-looking characters.',
      ip_address_host: 'The link uses an IP address instead of a familiar domain name.',
      url_shortener: 'This is a shortened link, so its final destination is not visible here.',
      insecure_http: 'The link uses an unencrypted HTTP connection.',
      pressure_words: 'The message uses words that pressure you to act quickly.',
      password_request: 'The message asks for a password or sign-in details.',
      official_domain_match: 'The domain matches an entry in the verified directory, but this does not prove the link or message is safe.',
      domain_unverified: 'This domain is not in the current verified organisation directory.',
      reserved_example_domain: 'This domain is reserved for examples and does not represent a real organisation.',
      no_clear_indicators: 'No clear warning signs appeared in the text; that does not prove the link is safe.',
    },
    nextStep: {
      do_not_open: 'Do not open the link. Delete or report the message if you were not expecting it.',
      verify_official_channel: 'Verify with the organisation through an official website or number you find yourself.',
      contact_sender: 'Ask the sender using a contact method you already know before proceeding.',
    },
    demoReasons: {
      suspicious: 'The message combines urgency with a password request, warning signs worth noticing in this fabricated example.',
      directory: 'In this fictional example, the host appears in a demonstration directory for an imaginary organisation. No real directory was queried.',
      insufficient: 'This example does not provide enough reliable information to identify who is behind the link or its context.',
    },
    demoNext: {
      suspicious: 'Do not open the link or enter a password. Check your account using the official address you find or type independently.',
      directory: 'Even when a demonstration shows a match, confirm the organisation through an independent official channel before sharing information.',
      insufficient: 'Find the organisation’s official contact details independently, and ask the sender if the link was expected.',
    },
  },
} as const;

const demos: Record<DemoId, { url: string; message: string }> = {
  suspicious: {
    url: 'https://account-urgent-login.example/verify',
    message: 'Act now to keep your account. Confirm your password immediately.',
  },
  directory: {
    url: 'https://portal.nour-community.example/',
    message: 'A fictional community directory match example.',
  },
  insufficient: {
    url: 'https://notice.example/',
    message: '',
  },
};

const demoHosts: Record<DemoId, string> = {
  suspicious: 'account-urgent-login.example',
  directory: 'portal.nour-community.example',
  insufficient: 'notice.example',
};

function Tarraya() {
  const [language, setLanguage] = useState<Language>('ar');
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const [resultView, setResultView] = useState<ResultView | null>(null);
  const mutation = useCheckLink();
  const t = copy[language];
  const isArabic = language === 'ar';
  const DirectionArrow = isArabic ? ArrowLeft : ArrowRight;
  const busy = mutation.isPending;

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
  }, [isArabic, language]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) return;
    mutation.mutate(
      { data: { url: cleanUrl, language, ...(message.trim() ? { message: message.trim() } : {}) } },
      { onSuccess: (result) => setResultView({ kind: 'live', result }), onError: () => setResultView(null) },
    );
    setResultView(null);
  };

  const showDemo = (id: DemoId) => {
    mutation.reset();
    setUrl(demos[id].url);
    setMessage(demos[id].message);
    setResultView({ kind: 'demo', id });
  };

  const resetForm = () => {
    setResultView(null);
    setUrl('');
    setMessage('');
    mutation.reset();
    document.getElementById('link-url')?.focus();
  };

  const displayedAssessment: LinkCheckResultAssessment | 'demo-insufficient' | 'demo-match' | undefined = resultView?.kind === 'demo'
    ? resultView.id === 'suspicious' ? 'suspicious' : resultView.id === 'directory' ? 'demo-match' : 'demo-insufficient'
    : resultView?.result.assessment;
  const currentDemo = resultView?.kind === 'demo' ? resultView.id : null;
  const resultHost = currentDemo ? demoHosts[currentDemo] : resultView?.kind === 'live' ? resultView.result.host : '';
  const liveResult = resultView?.kind === 'live' ? resultView.result : null;
  const reasons = currentDemo === 'directory'
    ? [t.demoReasons.directory]
    : currentDemo === 'insufficient'
      ? [t.demoReasons.insufficient]
      : currentDemo === 'suspicious'
        ? [t.demoReasons.suspicious]
        : liveResult?.evidence.map((item) => t.reason[item.code]) ?? [];
  const nextStep = currentDemo === 'directory'
    ? t.demoNext.directory
    : currentDemo === 'insufficient'
      ? t.demoNext.insufficient
      : currentDemo === 'suspicious'
        ? t.demoNext.suspicious
        : liveResult ? t.nextStep[liveResult.nextStep.code] : '';
  const assessmentTitle = currentDemo === 'directory'
    ? t.demoMatched
    : displayedAssessment === 'demo-insufficient'
      ? t.insufficient
      : displayedAssessment === 'demo-match'
        ? t.demoMatched
        : displayedAssessment
          ? t.assessment[displayedAssessment]
          : '';

  const onUrlChange = (value: string) => {
    setUrl(value);
    if (resultView) setResultView(null);
    if (mutation.isError) mutation.reset();
  };

  return (
    <main className="app-shell" dir={isArabic ? 'rtl' : 'ltr'} data-testid="page-tarraya">
      <div className="page-wrap">
        <header className="topbar">
          <div className="wordmark" aria-label={isArabic ? 'تريّا — Tarraya' : 'Tarraya — تريّا'}>
            <span className="wordmark-ar">تريّا</span>
            <span className="wordmark-en">TARRAYA</span>
          </div>
          <button className="language-switch" type="button" onClick={() => setLanguage(isArabic ? 'en' : 'ar')} data-testid="button-language">
            {t.language}
          </button>
        </header>

        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-mark" aria-hidden="true" />{t.eyebrow}</div>
            <h1 id="hero-title">{t.headlineA}<br /><em>{t.headlineB}</em><br />{t.headlineC}</h1>
            <p className="hero-intro">{t.intro}</p>
            <div className="trust-note">
              <span className="trust-icon"><ShieldCheck size={17} aria-hidden="true" /></span>
              <span>{t.trust}</span>
            </div>
          </div>

          <div className="form-card">
            <h2 className="form-title">{t.cardTitle}</h2>
            <p className="form-subtitle">{t.cardSub}</p>
            <form onSubmit={submit} data-testid="form-link-check">
              <div className="field-group">
                <label className="field-label" htmlFor="link-url">{t.urlLabel}</label>
                <input
                  className="url-input"
                  id="link-url"
                  name="url"
                  type="url"
                  required
                  maxLength={2048}
                  dir="ltr"
                  autoComplete="url"
                  placeholder="https://example.com/…"
                  value={url}
                  onChange={(event) => onUrlChange(event.target.value)}
                  aria-describedby="url-hint"
                  data-testid="input-url"
                />
                <p className="field-hint" id="url-hint">{t.urlHint}</p>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="link-message">{t.messageLabel}</label>
                <textarea
                  className="message-input"
                  id="link-message"
                  name="message"
                  maxLength={2000}
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    if (resultView) setResultView(null);
                    if (mutation.isError) mutation.reset();
                  }}
                  aria-describedby="message-hint"
                  data-testid="input-message"
                />
                <p className="field-hint" id="message-hint">{t.messageHint}</p>
              </div>
              <button className="primary-button" type="submit" disabled={busy} data-testid="button-submit">
                <span>{t.submit}</span><DirectionArrow className="button-arrow" size={19} aria-hidden="true" />
              </button>
              <div className="loading-line" role="status" aria-live="polite" data-testid="status-loading">
                {busy && <><span className="loading-dots" aria-hidden="true"><i /><i /><i /></span><span>{t.loading}</span></>}
              </div>
              {mutation.isError && <p className="form-error" role="alert" data-testid="status-error">{t.error}</p>}
            </form>
          </div>
        </section>

        {resultView && displayedAssessment && (
          <section className="result-section" aria-live="polite" aria-labelledby="result-title" data-testid="panel-result">
            <div className="result-card">
              <div className={`result-top${currentDemo ? ' demo' : ''}`}>
                <div className="result-heading">
                  <span className={`result-icon${displayedAssessment === 'suspicious' ? ' suspicious' : ' insufficient'}`}>
                    {displayedAssessment === 'suspicious' ? <CircleAlert size={21} aria-hidden="true" /> : <ClipboardCheck size={21} aria-hidden="true" />}
                  </span>
                  <div>
                    <p className="result-kicker">{currentDemo ? t.demoBadge : t.liveLabel}</p>
                    <h2 className="result-title" id="result-title">{assessmentTitle}</h2>
                  </div>
                </div>
                {currentDemo && <span className="demo-stamp" data-testid="badge-demo">{t.demoBadge}</span>}
              </div>
              <div className="result-body">
                <div className="result-column">
                  <h3><Sparkles size={16} aria-hidden="true" />{t.reasons}</h3>
                  {resultHost && <p className="field-hint">{t.host}: <b dir="ltr">{resultHost}</b></p>}
                  <ul className="reason-list" data-testid="list-result-reasons">
                    {reasons.map((reason, index) => <li key={`${index}-${reason}`}><span className="reason-bullet" aria-hidden="true" />{reason}</li>)}
                  </ul>
                  {liveResult?.organisationMatch && (
                    <div className="organisation-proof" data-testid="panel-organisation-match">
                      <strong>{t.directoryTitle}: {liveResult.organisationMatch.name}</strong>
                      <span dir="ltr">{liveResult.organisationMatch.officialDomain}</span>
                      <span>{t.verifiedOn}: {liveResult.organisationMatch.dateVerified}</span>
                      <a href={liveResult.organisationMatch.sourceUrl} target="_blank" rel="noopener noreferrer" dir="ltr" data-testid="link-verification-source">
                        {t.sourceLabel}
                      </a>
                      <p>{t.matchSafetyNotice}</p>
                    </div>
                  )}
                </div>
                <div className="result-column">
                  <h3><ShieldCheck size={16} aria-hidden="true" />{t.next}</h3>
                  <div className="next-step" data-testid="text-next-step">
                    <strong>{assessmentTitle}</strong>
                    {nextStep}
                  </div>
                </div>
              </div>
              <p className="result-disclaimer" data-testid="text-disclaimer">
                {currentDemo ? <><strong>{t.demoOnly}</strong> </> : null}{t.disclaimer}
                {liveResult?.organisationMatch && <> {t.matchSafetyNotice}</>}
              </p>
              <div className="result-actions">
                <button className="secondary-button" type="button" onClick={resetForm} data-testid="button-check-another">
                  <span>{t.checkAgain}</span><DirectionArrow size={17} aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="demos-section" aria-labelledby="demos-title">
          <div className="section-head">
            <div>
              <p className="section-kicker">{isArabic ? 'تعلّم بالمثال' : 'LEARN BY EXAMPLE'}</p>
              <h2 className="section-title" id="demos-title">{t.demoTitle}</h2>
            </div>
            <p className="section-copy">{t.demoCopy}</p>
          </div>
          <div className="demo-grid">
            <button className="demo-button" type="button" onClick={() => showDemo('suspicious')} aria-pressed={currentDemo === 'suspicious'} data-testid="button-demo-suspicious">
              <span className="demo-tag">{isArabic ? 'مثال' : 'DEMO'}</span>
              <span className="demo-label">{t.demoSuspicious}</span>
              <span className="demo-url">account-urgent-login.example</span>
            </button>
            <button className="demo-button" type="button" onClick={() => showDemo('directory')} aria-pressed={currentDemo === 'directory'} data-testid="button-demo-directory">
              <span className="demo-tag">{isArabic ? 'مثال' : 'DEMO'}</span>
              <span className="demo-label">{t.demoDirectory}</span>
              <span className="demo-url">portal.nour-community.example</span>
            </button>
            <button className="demo-button" type="button" onClick={() => showDemo('insufficient')} aria-pressed={currentDemo === 'insufficient'} data-testid="button-demo-insufficient">
              <span className="demo-tag">{isArabic ? 'مثال' : 'DEMO'}</span>
              <span className="demo-label">{t.demoInsufficient}</span>
              <span className="demo-url">notice.example</span>
            </button>
          </div>
        </section>

        <section className="how-section" aria-labelledby="how-title">
          <h2 className="how-title" id="how-title">{t.howTitle}</h2>
          <div>
            <p className="how-copy" dangerouslySetInnerHTML={{ __html: t.howCopy }} />
            <div className="official-note"><ShieldCheck size={18} aria-hidden="true" /><span>{t.officialNote}</span></div>
          </div>
        </section>

        <footer className="footer">
          <span className="footer-brand">{isArabic ? 'تريّا' : 'Tarraya'} · {t.footer}</span>
          <span>{t.footerSub}</span>
        </footer>
      </div>
    </main>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Tarraya />
    </QueryClientProvider>
  );
}

export default App;
