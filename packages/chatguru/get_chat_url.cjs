const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SERVER = process.env.CHATGURU_SERVER || "13";
const sessionPath = path.join(__dirname, "session.json");

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const phone = process.argv[2];
  if (!phone) { console.error("Uso: node get_chat_url.cjs <telefone>"); process.exit(1); }

  const session = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(session.cookies);
  const page = await context.newPage();

  try {
    await page.goto(`https://s${SERVER}.expertintegrado.app/chats`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(5000);

    if (page.url().includes("/login")) {
      console.error("SESSAO_EXPIRADA");
      await browser.close();
      process.exit(1);
    }

    // Select "Expert Integrado" device in Aparelho dropdown
    const aparelhoSelect = await page.$("select");
    if (aparelhoSelect) {
      const options = await aparelhoSelect.$$("option");
      for (const opt of options) {
        const text = await opt.textContent();
        if (text && text.toLowerCase().includes("expert integrado")) {
          const value = await opt.getAttribute("value");
          await aparelhoSelect.selectOption(value);
          await sleep(1000);
          break;
        }
      }
    }

    // Enable archived filter (correct selector from list_chats)
    const archivedCb = await page.$(".list__single__filter.archived input[type='checkbox']");
    if (archivedCb) {
      await archivedCb.click();
      await sleep(2000);
    }

    // Fill phone number and search
    const phoneInput = await page.waitForSelector("#inChatsWhatsappNum", { timeout: 10000 });
    await phoneInput.fill(phone);
    await page.keyboard.press("Enter");
    await sleep(4000);

    let chatItems = await page.$$(".list__user-card");

    if (chatItems.length === 0) {
      await page.screenshot({ path: path.join(__dirname, "debug_notfound.png") });
      console.error("NAO_ENCONTRADO");
      await browser.close();
      process.exit(1);
    }

    await chatItems[0].click();
    await sleep(2000);

    const currentUrl = page.url();
    const hashMatch = currentUrl.match(/#([a-f0-9]{24})/);

    await browser.close();

    if (hashMatch) {
      const chatId = hashMatch[1];
      const link = `https://s${SERVER}.expertintegrado.app/chats#${chatId}`;
      console.log(JSON.stringify({ chat_id: chatId, link: link }));
    } else {
      console.error("CHAT_ID_NAO_EXTRAIDO|" + currentUrl);
      process.exit(1);
    }
  } catch (err) {
    await browser.close().catch(() => {});
    console.error("ERRO|" + err.message);
    process.exit(1);
  }
}

main();
