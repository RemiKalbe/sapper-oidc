beforeEach(() => {
  cy.clearCookies({ domain: null });
});

describe("Login by clicking on login btn", () => {
  it("Click on the login button and log in", () => {
    cy.visit("http://localhost:3001");
    cy.get("#login").click();
    cy.get("#email").type("foo@bar.com");
    cy.get("#password").type("foobar");
    cy.get("#accept").click();
    cy.url().then(($url) => {
      if ($url.includes("consent")) {
        cy.get("#openid").check();
        cy.get("#profile").check();
        cy.get("#offline").check();
        cy.get("#accept").click();
      }
    });
    cy.url().should("include", "cb");
    cy.get("h1").should(($h) => {
      expect($h).to.contain("Yes");
    });
  });
});
