describe('create an organization', () => {
  beforeEach(() => {
    cy.login({ redirect: '/organizations/new' });
  });

  it('Creates an organization successfully without co-admin', () => {
    cy.get('input[name=name]').type('testOrganization4');
    cy.get('textarea[name=description]').type('short description for new org');
    cy.get('input[name=website]').type('co.com');
    cy.get('div[name=authorization]').click();
    cy.get('button[type=submit]').click();
    cy.get('[data-cy="cof-form-name"');
  });

  it('Shows an Error if Authorization is not checked', () => {
    cy.get('input[name=name]').type('testOrganization2');
    cy.get('textarea[name=description]').type('short description for new org');
    cy.get('input[name=website]').type('newco.com');
    cy.get('button[type=submit]').click();
    cy.get('div[type=error]').contains('Please verify that you are an authorized representative of this organization');
  });
});
