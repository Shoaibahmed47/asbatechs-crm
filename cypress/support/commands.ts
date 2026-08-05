/// <reference types="cypress" />

Cypress.Commands.add("loginAsAdmin", () => {
  const email = Cypress.env("adminEmail") as string;
  const password = Cypress.env("adminPassword") as string;

  cy.request({
    method: "POST",
    url: "/api/auth/login",
    body: { email, password },
    failOnStatusCode: false
  }).then((res) => {
    if (
      res.status === 401 &&
      /Protected deployment|vercel_auth/i.test(JSON.stringify(res.body))
    ) {
      throw new Error(
        "Host is Vercel SSO protected — use https://asbatechs-crm-web.vercel.app"
      );
    }
    expect(res.status, `login status ${res.status}`).to.be.oneOf([200, 201]);
    expect(res.body?.token, "login token").to.be.a("string").and.not.be.empty;

    const token = res.body.token as string;
    cy.setCookie("crm_token", token, { httpOnly: false });
    cy.window({ log: false }).then((win) => {
      try {
        win.localStorage.setItem("crm_token", token);
      } catch {
        /* ignore */
      }
    });
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      loginAsAdmin(): Chainable<void>;
    }
  }
}

export {};
