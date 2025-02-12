export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

import { JwtPayload } from "jsonwebtoken";
import jwt from "jsonwebtoken";

// Utils for Puppeteer tools

import { Page, ElementHandle } from "puppeteer";
import decode from "unidecode";
import { AuthToken } from "../types.js";

/**
 * Check if the given text ends with a complete sentence.
 */
export function isCompleteSentence(text: string): boolean {
  return /[.!?]\s*$/.test(text);
}
// Define the secret key for signing JWTs
const JWT_SECRET = process.env.JWT_SECRET;
// Function to generate a JWT
export function generateJWT(
  user_id: string,
  thread_id: string,
  session_id: string
): string {
  if (!user_id || !thread_id || !session_id) {
    return "Missing required parametes for authentication";
  }

  const payload: JwtPayload = {
    user_id: user_id,
    thread_id: thread_id,
    session_id: session_id,
  };
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: "1h" }); // Token expires in 1 hour
}

// Function to verify a JWT and validate user_id and thread_id
export function verifyJWT(authToken: AuthToken): boolean {
  try {
    if (!authToken.userId || !authToken.threadId || !authToken.sessionId) {
      return false;
    }
    const payload = jwt.verify(
      authToken.token,
      JWT_SECRET as string
    ) as JwtPayload;
    if (
      payload.user_id === authToken.userId &&
      payload.thread_id === authToken.threadId &&
      payload.session_id === authToken.sessionId
    ) {
      return true;
    } else {
      console.error(
        "JWT payload does not match the provided user_id and thread_id."
      );
      return false;
    }
  } catch (error) {
    console.error("JWT verification failed:", error);
    return false;
  }
}

/**
 * Get all text elements visible on the page.
 */
export async function getAllTextElements(page: Page): Promise<string[]> {
  const elements = await page.$$(":not(script):not(style):not(noscript)");

  const texts: string[] = [];
  for (const element of elements) {
    const isVisible = await element.boundingBox();
    if (isVisible) {
      const text = await page.evaluate(
        (el: any) => el.textContent?.trim() || "",
        element
      );
      if (text) texts.push(prettifyText(text));
    }
  }
  //const elements = await page.$$(
  //"button, input[type='button'], input[type='submit'],input[type='q'] textarea"
  // );

  // Extract the text or value from each element
  //const texts = [];
  /*for (const element of elements) {
    const text = await element.evaluate((el) => {
      if (el.tagName.toLowerCase() === "textarea") {
        return el.value.trim(); // Textareas use `value`
      } else if (el.tagName.toLowerCase() === "input") {
        return el.value.trim(); // Input buttons use `value`
      } else {
        return el.textContent ? el.textContent.trim() : ""; // Buttons use `textContent`
      }
    });

    if (text && text.length > 0) {
      texts.push(text);
    }
  }*/
  return texts;
}

/**
 * Find all interactable elements on the page (buttons and links).
 */
/*export async function findInteractableElements(page: Page): Promise<string[]> {
  const buttons = await page.$$("button");
  const links = await page.$$("a");
  const inputs = await page.$$("input");
  const textarea = await page.$$("textarea");

  const interactableElements = [...buttons, ...links, ...inputs, ...textarea];
  const interactableTexts: string[] = [];

  for (const element of interactableElements) {
    const isVisible = await element.boundingBox();
    const isEnabled = await page.evaluate(
      (el) => !el.hasAttribute("disabled"),
      element
    );

    if (isVisible && isEnabled) {
      const text = await page.evaluate(
        (el) => el.textContent?.trim() || "",
        element
      );
      if (text && !interactableTexts.includes(text)) {
        interactableTexts.push(prettifyText(text, 50));
      }
    }
  }

  return interactableTexts;
}*/

export async function findInteractableElements(page: Page): Promise<string[]> {
  const buttons = await page.$$("button");
  const links = await page.$$("a");
  const inputs = await page.$$("input");
  const textareas = await page.$$("textarea");
  const selects = await page.$$("select");
  const divs = await page.$$("[role='button']");
  const spans = await page.$$("[role='button']");
  const contentEditables = await page.$$("[contenteditable='true']");
  const images = await page.$$("img");

  const interactableElements = [
    ...buttons,
    ...links,
    ...inputs,
    ...textareas,
    ...selects,
    ...divs,
    ...spans,
    ...contentEditables,
    ...images,
  ];

  const interactableTexts: string[] = [];

  for (const element of interactableElements) {
    const isVisible = await element.boundingBox();
    const isEnabled = await page.evaluate(
      (el) => !el.hasAttribute("disabled"),
      element
    );

    if (isVisible && isEnabled) {
      const text =
        (await page.evaluate(
          (el) =>
            el.textContent?.trim() ||
            el.getAttribute("placeholder") ||
            el.getAttribute("alt") ||
            "",
          element
        )) || "";

      if (text && !interactableTexts.includes(text)) {
        interactableTexts.push(prettifyText(text, 50));
      }
    }
  }

  // Extract select options
  for (const select of selects) {
    const options = await select.$$eval("option", (opts) =>
      opts.map((opt) => opt.textContent?.trim() || "")
    );
    interactableTexts.push(
      ...options.filter((opt) => opt && !interactableTexts.includes(opt))
    );
  }

  return interactableTexts;
}

/**
 * Prettify text by normalizing whitespace, converting to lowercase, and removing diacritics.
 */
export function prettifyText(text: string, limit?: number): string {
  text = text.replace(/\s+/g, " ").trim().toLowerCase();
  text = decode(text);
  if (limit) text = text.slice(0, limit);
  return text;
}

/**
 * Check if an element is completely viewable in the browser window.
 */
export async function elementCompletelyViewable(
  page: Page,
  element: ElementHandle
): Promise<boolean> {
  const boundingBox = await element.boundingBox();
  if (!boundingBox) return false;

  const windowScrollY = await page.evaluate(() => window.scrollY);
  const windowScrollX = await page.evaluate(() => window.scrollX);
  const windowHeight = await page.evaluate(() => window.innerHeight);
  const windowWidth = await page.evaluate(() => window.innerWidth);

  const elementTop = boundingBox.y;
  const elementLeft = boundingBox.x;
  const elementBottom = elementTop + boundingBox.height;
  const elementRight = elementLeft + boundingBox.width;

  return (
    elementTop >= windowScrollY &&
    elementBottom <= windowScrollY + windowHeight &&
    elementLeft >= windowScrollX &&
    elementRight <= windowScrollX + windowWidth
  );
}

/**
 * Find the text of an element or up to its third-order parent.
 */
export async function findParentElementText(
  element: ElementHandle,
  prettify: boolean = true
): Promise<string> {
  let text = await element.evaluate((el) => el.textContent?.trim() || "");
  if (text) return prettify ? prettifyText(text) : text;

  const parents = await (element as any).$x("./ancestor::*[position() <= 3]");
  for (const parent of parents) {
    text = await parent.evaluate((el: any) => el.textContent?.trim() || "");
    if (text) return prettify ? prettifyText(text) : text;
  }

  return "";
}

/**
 * Truncate a string from the last occurrence of a character.
 */
export function truncateStringFromLastOccurrence(
  string: string,
  character: string
): string {
  const lastIndex = string.lastIndexOf(character);
  if (lastIndex !== -1) {
    return string.slice(0, lastIndex + 1);
  }
  return string;
}
