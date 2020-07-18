beforeEach(() => {
  cy.clearCookies({ domain: null });
});

describe("Login by clicking on protected paths", () => {
  it("Click on the 'Protected Path (Recursive)' button and log in", () => {
    cy.visit("http://localhost:3001/private-info");
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
      expect($h).to.contain("Yes PPR");
    });
  });

  it("Click on the 'Protected Path (Recursive) Deeper' button and log in", () => {
    cy.visit("http://localhost:3001/private-info/deeper");
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
      expect($h).to.contain("Yes PPRD");
    });
  });

  it("Click on the 'Protected Path (Not Recursive)' button and log in", () => {
    cy.visit("http://localhost:3001/privateOnlyHere");
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
      expect($h).to.contain("Yes PPNR");
    });
  });

  it("Click on the 'Not Protected Path (Not Recursive) Deeper' button and not log in", () => {
    cy.visit("http://localhost:3001/privateOnlyHere/deeper");
    cy.get("h1").should(($h) => {
      expect($h).to.contain("No NPPNR");
    });
  });
});
