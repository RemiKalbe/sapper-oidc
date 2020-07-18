beforeEach(() => {
  cy.clearCookies({ domain: null });
});

describe("Login by clicking on login btn and then navigate", () => {
  it("Click on the login button and log in and then navigate and check if it is still logged in", () => {
    cy.visit("http://localhost:3001");
    cy.get("#login").click();
    cy.get("#email").type("foo@bar.com");
    cy.get("#password").type("foobar");
    cy.get("#remember").check();
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
    cy.wait(500);

    cy.get("h2")
      .invoke("text")
      .then((exp1) => {
        cy.wait(exp1 * 1000 - Date.now());
        cy.get("h2")
          .invoke("text")
          .should((exp2) => {
            expect(exp1).not.to.eq(exp2);
          });
      });
  });
});
