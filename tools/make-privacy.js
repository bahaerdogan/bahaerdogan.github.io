#!/usr/bin/env node
/**
 * Generate the privacy policy pages (EN/TR/DE).
 *
 * The site had no privacy policy at all while running Google Analytics, a
 * comment store and a contact form, and explicitly targeting German readers via
 * hreflang — analytics without a stated basis plus EU targeting is real
 * exposure, not a checklist nit.
 *
 * The page shell (head, nav, footer, consent banner) is cloned from an existing
 * page so the policy cannot drift from the rest of the site. Only the <main>
 * body is authored here.
 *
 * Idempotent: re-running regenerates the same three files from the current shell.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHELL = 'BlogPosts.html';
const CONTACT = 'baha@bahaerdogan.com';
const UPDATED = '2026-07-28';

const COMMON = {
  ga: ['_ga', '_ga_ZGTWHSMVV7'],
};

const CONTENT = {
  en: {
    file: 'privacy.html',
    lang: 'en',
    title: 'Privacy Policy | Baha Erdoğan',
    description: 'What data bahaerdogan.com collects, why, on what legal basis, how long it is kept, and how to exercise your rights.',
    heading: 'Privacy Policy',
    updated: `Last updated: ${UPDATED}`,
    intro: `This site is a personal portfolio and publication hub operated by Baha Erdoğan. It collects as little as possible. This page describes exactly what is collected, why, on what legal basis under the GDPR and the Turkish KVKK, and how long it is kept. Questions go to <a href="mailto:${CONTACT}">${CONTACT}</a>.`,
    sections: [
      ['Analytics', `Google Analytics 4 measures aggregate traffic. <strong>It is off until you agree.</strong> The site loads with Google Consent Mode v2 set to <code>denied</code> for analytics, advertising and personalisation storage, so no analytics cookies are written and no measurement occurs unless you press “Accept All” or enable Analytics under “Settings”.<br><br><strong>Cookies:</strong> ${COMMON.ga.join(', ')} — written only after consent.<br><strong>Legal basis:</strong> your consent (GDPR Art. 6(1)(a)).<br><strong>Retention:</strong> Google's GA4 default, currently 14 months.<br><strong>Withdrawing consent:</strong> clear this site's data in your browser, or set your choice again from the cookie banner. Your decision is stored locally under <code>cookie-consent</code> and never leaves your device.`],
      ['Contact form', `The name, email address, subject and message you type are emailed to the site owner through Resend, the email provider. <strong>They are not written to any database.</strong><br><br><strong>Legal basis:</strong> steps taken at your request prior to contact (GDPR Art. 6(1)(b)) and legitimate interest in replying (Art. 6(1)(f)).<br><strong>Retention:</strong> for as long as the resulting correspondence is kept.`],
      ['Comments', `If you post a comment, <strong>your name and the comment text are stored and shown publicly</strong> on the article page. Your email address is used only to notify the site owner so a reply is possible — <strong>it is not stored</strong> with the comment and is not published.<br><br><strong>Legal basis:</strong> your consent, given by submitting the form (GDPR Art. 6(1)(a)).<br><strong>Retention:</strong> until you ask for removal. Email <a href="mailto:${CONTACT}">${CONTACT}</a> and the comment will be deleted.`],
      ['Abuse prevention', `To stop the comment and contact forms being flooded, submissions are rate-limited to three per hour. <strong>Your IP address is not stored.</strong> The counter is keyed on a truncated SHA-256 hash of it, which distinguishes callers without retaining an identifier, and the record expires automatically after one hour.<br><br>If bot protection (Cloudflare Turnstile) is enabled, Cloudflare receives your IP address to run that check, as its processor.<br><br><strong>Legal basis:</strong> legitimate interest in keeping the site available and free of abuse (GDPR Art. 6(1)(f)).`],
      ['Hosting and logs', `The site is served as static files by GitHub Pages, behind Cloudflare. Both process connection data — including your IP address — to deliver pages and to protect against attacks. This happens for every website you visit and is outside the site owner's control.<br><br><strong>Legal basis:</strong> legitimate interest in delivering and securing the service (GDPR Art. 6(1)(f)).`],
      ['Processors and international transfers', `Google (analytics), Cloudflare (delivery, storage, bot protection), Resend (email delivery) and GitHub (hosting) act as processors. Some are based outside the EEA and may process data there, under the European Commission's Standard Contractual Clauses or an applicable adequacy decision.<br><br><strong>No data is sold, and none is shared for advertising.</strong>`],
      ['Your rights', `Under the GDPR and the KVKK you may request access to your data, correction, erasure, restriction of processing, portability, and you may object to processing based on legitimate interest. Where processing rests on consent, you may withdraw it at any time without affecting what was lawful beforehand.<br><br>Write to <a href="mailto:${CONTACT}">${CONTACT}</a>. You also have the right to complain to your national data protection authority — in Turkey, the KVKK Authority (KVKK Kurumu).`],
      ['Children', `The site is not directed at children under 16 and does not knowingly collect their data.`],
      ['Changes', `If this policy changes, the date at the top of the page changes with it.`],
    ],
  },

  tr: {
    file: 'privacy-tr.html',
    lang: 'tr',
    title: 'Gizlilik Politikası | Baha Erdoğan',
    description: 'bahaerdogan.com hangi verileri, neden, hangi hukuki sebebe dayanarak topluyor; ne kadar saklıyor ve haklarınızı nasıl kullanırsınız.',
    heading: 'Gizlilik Politikası',
    updated: `Son güncelleme: ${UPDATED}`,
    intro: `Bu site, Baha Erdoğan tarafından işletilen kişisel bir portfolyo ve yayın sitesidir. Mümkün olduğunca az veri toplar. Bu sayfa; tam olarak neyin toplandığını, nedenini, KVKK ve GDPR kapsamındaki hukuki sebebini ve saklama süresini açıklar. Sorularınız için: <a href="mailto:${CONTACT}">${CONTACT}</a>.`,
    sections: [
      ['Analitik', `Google Analytics 4 yalnızca toplu trafik ölçümü yapar. <strong>Siz onay vermeden çalışmaz.</strong> Site, Google Consent Mode v2 ile analitik, reklam ve kişiselleştirme depolaması <code>denied</code> (reddedildi) olarak yüklenir; “Tümünü Kabul Et” demediğiniz veya “Ayarlar” altından Analitik'i açmadığınız sürece analitik çerezi yazılmaz ve ölçüm yapılmaz.<br><br><strong>Çerezler:</strong> ${COMMON.ga.join(', ')} — yalnızca onaydan sonra.<br><strong>Hukuki sebep:</strong> açık rızanız (KVKK m.5/1; GDPR m.6(1)(a)).<br><strong>Saklama:</strong> Google GA4 varsayılanı, hâlihazırda 14 ay.<br><strong>Rızanın geri alınması:</strong> tarayıcınızdan bu sitenin verilerini silin veya çerez bandından tercihinizi yeniden belirleyin. Tercihiniz cihazınızda <code>cookie-consent</code> anahtarında tutulur ve cihazınızdan çıkmaz.`],
      ['İletişim formu', `Yazdığınız ad, e-posta adresi, konu ve mesaj; e-posta sağlayıcısı Resend üzerinden site sahibine iletilir. <strong>Herhangi bir veritabanına yazılmaz.</strong><br><br><strong>Hukuki sebep:</strong> talebiniz üzerine atılan adımlar ve yanıt verilmesindeki meşru menfaat (GDPR m.6(1)(b) ve (f)).<br><strong>Saklama:</strong> ilgili yazışma saklandığı sürece.`],
      ['Yorumlar', `Yorum gönderirseniz <strong>adınız ve yorum metniniz saklanır ve makale sayfasında herkese açık gösterilir.</strong> E-posta adresiniz yalnızca site sahibine bildirim gönderip yanıt verilebilmesi için kullanılır; <strong>yorumla birlikte saklanmaz</strong> ve yayımlanmaz.<br><br><strong>Hukuki sebep:</strong> formu göndererek verdiğiniz açık rıza.<br><strong>Saklama:</strong> silinmesini isteyene kadar. <a href="mailto:${CONTACT}">${CONTACT}</a> adresine yazmanız yeterlidir.`],
      ['Kötüye kullanımın önlenmesi', `Yorum ve iletişim formlarının kötüye kullanılmaması için gönderimler saatte üç ile sınırlıdır. <strong>IP adresiniz saklanmaz.</strong> Sayaç, IP'nin kısaltılmış SHA-256 özetine göre tutulur; bu, kimliği saklamadan çağrıları birbirinden ayırır ve kayıt bir saat sonra kendiliğinden silinir.<br><br>Bot koruması (Cloudflare Turnstile) etkinse, bu kontrolü yapmak üzere Cloudflare veri işleyen sıfatıyla IP adresinizi alır.<br><br><strong>Hukuki sebep:</strong> sitenin erişilebilir ve kötüye kullanımdan uzak tutulmasındaki meşru menfaat.`],
      ['Barındırma ve kayıtlar', `Site, Cloudflare arkasında GitHub Pages tarafından statik dosya olarak sunulur. Her ikisi de sayfaları iletmek ve saldırılara karşı korumak için IP adresiniz dâhil bağlantı verilerini işler. Bu, ziyaret ettiğiniz her sitede olur ve site sahibinin denetiminde değildir.<br><br><strong>Hukuki sebep:</strong> hizmetin sunulması ve güvenliğindeki meşru menfaat.`],
      ['Veri işleyenler ve yurt dışına aktarım', `Google (analitik), Cloudflare (dağıtım, depolama, bot koruması), Resend (e-posta) ve GitHub (barındırma) veri işleyen sıfatıyla hareket eder. Bir kısmı AEA dışında bulunur ve verileri orada işleyebilir; bu aktarım Standart Sözleşme Hükümleri veya geçerli bir yeterlilik kararı kapsamında yapılır.<br><br><strong>Veriler satılmaz ve reklam amacıyla paylaşılmaz.</strong>`],
      ['Haklarınız', `KVKK ve GDPR uyarınca; verilerinize erişme, düzeltilmesini, silinmesini veya işlenmesinin kısıtlanmasını isteme, taşınabilirlik ve meşru menfaate dayalı işlemeye itiraz etme haklarına sahipsiniz. Rızaya dayanan işlemelerde rızanızı dilediğiniz an geri alabilirsiniz; bu, geri almadan önceki işlemenin hukuka uygunluğunu etkilemez.<br><br><a href="mailto:${CONTACT}">${CONTACT}</a> adresine yazabilirsiniz. Ayrıca Kişisel Verileri Koruma Kurumu'na (KVKK Kurumu) şikâyette bulunma hakkınız vardır.`],
      ['Çocuklar', `Site 16 yaşından küçüklere yönelik değildir ve bilerek onlara ait veri toplamaz.`],
      ['Değişiklikler', `Bu politika değişirse sayfanın başındaki tarih de değişir.`],
    ],
  },

  de: {
    file: 'privacy-de.html',
    lang: 'de',
    title: 'Datenschutzerklärung | Baha Erdoğan',
    description: 'Welche Daten bahaerdogan.com erhebt, warum, auf welcher Rechtsgrundlage, wie lange sie gespeichert werden und wie Sie Ihre Rechte ausüben.',
    heading: 'Datenschutzerklärung',
    updated: `Zuletzt aktualisiert: ${UPDATED}`,
    intro: `Diese Website ist ein persönliches Portfolio von Baha Erdoğan und erhebt so wenig Daten wie möglich. Diese Seite beschreibt genau, was erhoben wird, warum, auf welcher Rechtsgrundlage nach DSGVO und türkischem KVKK, und wie lange es gespeichert bleibt. Fragen an <a href="mailto:${CONTACT}">${CONTACT}</a>.`,
    sections: [
      ['Analyse', `Google Analytics 4 misst ausschließlich aggregierten Traffic. <strong>Es ist deaktiviert, bis Sie zustimmen.</strong> Die Seite lädt mit Google Consent Mode v2, bei dem Analyse-, Werbe- und Personalisierungsspeicher auf <code>denied</code> stehen. Solange Sie nicht „Accept All“ wählen oder Analytics unter „Settings“ aktivieren, wird kein Analyse-Cookie gesetzt und keine Messung durchgeführt.<br><br><strong>Cookies:</strong> ${COMMON.ga.join(', ')} — erst nach Einwilligung.<br><strong>Rechtsgrundlage:</strong> Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).<br><strong>Speicherdauer:</strong> GA4-Standard von Google, derzeit 14 Monate.<br><strong>Widerruf:</strong> Löschen Sie die Websitedaten im Browser oder setzen Sie Ihre Auswahl im Cookie-Banner neu. Ihre Entscheidung wird lokal unter <code>cookie-consent</code> gespeichert und verlässt Ihr Gerät nicht.`],
      ['Kontaktformular', `Name, E-Mail-Adresse, Betreff und Nachricht werden über den E-Mail-Dienst Resend an den Betreiber gesendet. <strong>Sie werden in keiner Datenbank gespeichert.</strong><br><br><strong>Rechtsgrundlage:</strong> vorvertragliche Maßnahmen auf Ihre Anfrage sowie berechtigtes Interesse an der Beantwortung (Art. 6 Abs. 1 lit. b und f DSGVO).<br><strong>Speicherdauer:</strong> solange der Schriftwechsel aufbewahrt wird.`],
      ['Kommentare', `Wenn Sie kommentieren, <strong>werden Ihr Name und der Kommentartext gespeichert und öffentlich angezeigt.</strong> Ihre E-Mail-Adresse dient nur der Benachrichtigung des Betreibers, damit eine Antwort möglich ist — <strong>sie wird nicht mit dem Kommentar gespeichert</strong> und nicht veröffentlicht.<br><br><strong>Rechtsgrundlage:</strong> Ihre Einwilligung durch Absenden des Formulars.<br><strong>Speicherdauer:</strong> bis Sie die Löschung verlangen. Eine E-Mail an <a href="mailto:${CONTACT}">${CONTACT}</a> genügt.`],
      ['Missbrauchsschutz', `Damit Kommentar- und Kontaktformular nicht geflutet werden, sind drei Übermittlungen pro Stunde zulässig. <strong>Ihre IP-Adresse wird nicht gespeichert.</strong> Der Zähler nutzt einen gekürzten SHA-256-Hash der IP, der Aufrufer unterscheidet, ohne ein Identifikationsmerkmal aufzubewahren; der Eintrag verfällt nach einer Stunde automatisch.<br><br>Ist der Bot-Schutz (Cloudflare Turnstile) aktiv, erhält Cloudflare als Auftragsverarbeiter Ihre IP-Adresse für diese Prüfung.<br><br><strong>Rechtsgrundlage:</strong> berechtigtes Interesse an Verfügbarkeit und Missbrauchsfreiheit (Art. 6 Abs. 1 lit. f DSGVO).`],
      ['Hosting und Protokolle', `Die Website wird als statische Dateien von GitHub Pages hinter Cloudflare ausgeliefert. Beide verarbeiten Verbindungsdaten einschließlich Ihrer IP-Adresse, um Seiten auszuliefern und vor Angriffen zu schützen. Das geschieht bei jeder Website und liegt außerhalb der Kontrolle des Betreibers.<br><br><strong>Rechtsgrundlage:</strong> berechtigtes Interesse an Bereitstellung und Sicherheit (Art. 6 Abs. 1 lit. f DSGVO).`],
      ['Auftragsverarbeiter und Drittlandtransfer', `Google (Analyse), Cloudflare (Auslieferung, Speicherung, Bot-Schutz), Resend (E-Mail) und GitHub (Hosting) handeln als Auftragsverarbeiter. Einige sitzen außerhalb des EWR und können Daten dort verarbeiten — auf Grundlage der EU-Standardvertragsklauseln oder eines geltenden Angemessenheitsbeschlusses.<br><br><strong>Daten werden nicht verkauft und nicht zu Werbezwecken weitergegeben.</strong>`],
      ['Ihre Rechte', `Nach DSGVO und KVKK haben Sie das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit sowie das Recht, einer auf berechtigtem Interesse beruhenden Verarbeitung zu widersprechen. Beruht die Verarbeitung auf Einwilligung, können Sie diese jederzeit widerrufen; die Rechtmäßigkeit der vorherigen Verarbeitung bleibt unberührt.<br><br>Schreiben Sie an <a href="mailto:${CONTACT}">${CONTACT}</a>. Zudem steht Ihnen ein Beschwerderecht bei Ihrer zuständigen Datenschutzaufsichtsbehörde zu.`],
      ['Kinder', `Die Website richtet sich nicht an Kinder unter 16 Jahren und erhebt wissentlich keine Daten von ihnen.`],
      ['Änderungen', `Ändert sich diese Erklärung, ändert sich auch das Datum am Seitenanfang.`],
    ],
  },
};

const shell = fs.readFileSync(path.join(ROOT, SHELL), 'utf8');

// Split the shell at <main>…</main>; everything outside is reused verbatim.
const openIdx = shell.indexOf('<main');
const openEnd = shell.indexOf('>', openIdx) + 1;
const closeIdx = shell.indexOf('</main>');
if (openIdx < 0 || closeIdx < 0) {
  console.error(`Could not locate <main> in ${SHELL}; nothing generated.`);
  process.exit(1);
}
const head = shell.slice(0, openEnd);
const tail = shell.slice(closeIdx);

function buildBody(c) {
  const secs = c.sections
    .map(([h2, body]) => `<section class="mb-4"><h2 class="h4 mb-2">${h2}</h2><p>${body}</p></section>`)
    .join('');

  // The shell's navbar renders white-on-transparent until the page is scrolled,
  // which is only legible over a dark hero. Reusing `blog-hero` gives the page
  // the same header the rest of the site has, and keeps the nav readable at the
  // top instead of white text on a near-white background.
  const hero = `<section class="blog-hero"><div class="container"><div class="row"><div class="col-sm-12">`
    + `<div class="text-center title-box">`
    + `<h1 class="title-a" style="font-size:3rem;margin-bottom:20px">${c.heading}</h1>`
    + `<p class="subtitle-a" style="font-size:1.2rem;opacity:.9">${c.updated}</p>`
    + `</div></div></div></div></section>`;

  return hero
    + `<div class="container" style="max-width:820px;padding-top:56px;padding-bottom:64px">`
    + `<p class="mb-4">${c.intro}</p>${secs}</div>`;
}

for (const c of Object.values(CONTENT)) {
  let page = head + buildBody(c) + tail;

  // Point the shell's own head at this page. updateI18nHeadsAndToggle in the
  // build owns hreflang and OpenGraph afterwards; these are the values it keys on.
  page = page
    .replace(/<html lang="[^"]*"/, `<html lang="${c.lang}"`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${c.title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${c.description}$2`)
    .replace(new RegExp(`https://bahaerdogan\\.com/${SHELL}`, 'g'), `https://bahaerdogan.com/${c.file}`)
    .replace(new RegExp(SHELL.replace('.', '\\.'), 'g'), c.file);

  fs.writeFileSync(path.join(ROOT, c.file), page, 'utf8');
  console.log(`wrote ${c.file}`);
}
