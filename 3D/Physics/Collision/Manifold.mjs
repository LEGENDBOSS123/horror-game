var Manifold = class {
    constructor(options) {
        this.body1 = options?.body1 ?? null;
        this.body2 = options?.body2 ?? null;
        this.contacts = options?.contacts ?? [];
    }

    addContact(contact) {
        this.contacts.push(contact);
    }

    clearContacts() {
        this.contacts = [];
    }
};


export default Manifold;