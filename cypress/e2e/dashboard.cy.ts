describe("Dashboard UI (Cypress)", () => {
  beforeEach(() => {
    cy.loginAsAdmin();
  });

  it("shows optimized overview, KPIs, charts, and agent table", () => {
    cy.visit("/dashboard?mode=daily");
    cy.location("pathname").should("include", "/dashboard");

    cy.get('[data-testid="app-sidebar-rail"]', { timeout: 25_000 }).should("be.visible");
    cy.contains('[data-testid="app-sidebar-rail"]', "AsbaTechs CRM").should("be.visible");

    cy.contains("h1", /Dashboard overview/i, { timeout: 20_000 }).should("be.visible");
    cy.contains(/^Live$/).should("be.visible");

    cy.get('[data-testid="dashboard-stat-cards"]').should("be.visible");
    cy.get('[data-testid="dashboard-stat-cards"]').contains(/Total leads/i).should("be.visible");
    cy.get('[data-testid="dashboard-stat-cards"]').contains(/Hot leads/i).should("be.visible");
    cy.get('[data-testid="dashboard-stat-cards"]').contains(/Sales leads/i).should("be.visible");
    cy.get('[data-testid="dashboard-stat-cards"]').contains(/Open shifts/i).should("be.visible");

    cy.contains("h2", /Performance analytics/i).should("be.visible");
    cy.contains(/Lead distribution|Lead mix/i).should("be.visible");
    cy.contains(/Revenue overview|Sales performance/i).should("be.visible");

    cy.contains("h2", /Team attendance monitor/i, { timeout: 25_000 }).should("be.visible");

    cy.get('[data-testid="agent-health-table-shell"], .crm-table-shell', { timeout: 30_000 })
      .first()
      .scrollIntoView()
      .should("be.visible");

    cy.get('[data-testid="agent-health-table"], table.crm-table', { timeout: 30_000 })
      .first()
      .as("agentTable")
      .should("exist");

    // Sticky thead can fail Cypress "visible" inside overflow shells — assert presence + text
    cy.get("@agentTable").find("thead th").should("have.length.at.least", 5);
    cy.get("@agentTable").contains("th", /Name/i).should("exist");
    cy.get("@agentTable").contains("th", /Status/i).should("exist");
    cy.get("@agentTable").contains("th", /Agent/i).should("exist");
    cy.get("@agentTable").find("tbody tr").should("have.length.at.least", 1);

    cy.document().then((doc) => {
      const overflow = doc.documentElement.scrollWidth > doc.defaultView!.innerWidth + 2;
      expect(overflow, "no horizontal page overflow").to.eq(false);
      const brandTeal = doc.defaultView!
        .getComputedStyle(doc.documentElement)
        .getPropertyValue("--brand-teal")
        .trim();
      expect(brandTeal.length, "brand teal token").to.be.greaterThan(0);
    });

    cy.get('[data-testid="sidebar-collapse-toggle"]').scrollIntoView().should("be.visible").click();
    cy.get('[data-testid="app-sidebar-rail"]').should("have.attr", "data-collapsed", "true");
    cy.get('[data-testid="sidebar-collapse-toggle"]').click();
    cy.get('[data-testid="app-sidebar-rail"]').should("have.attr", "data-collapsed", "false");
  });
});
