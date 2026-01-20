import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, doc, setDoc, orderBy } from 'firebase/firestore';

// Collection Name
const EVENTS_COLLECTION = 'award_events';

// 1. Fetch Active Events
export const fetchActiveAwardsEvents = async () => {
    try {
        const q = query(collection(db, EVENTS_COLLECTION), where("isActive", "==", true)); // Could sort by date here if we add indexes
        const querySnapshot = await getDocs(q);
        let events = [];
        querySnapshot.forEach((doc) => {
            events.push({ id: doc.id, ...doc.data() });
        });

        // Sort by date JS-side to avoid index requirement for now
        events.sort((a, b) => a.date.seconds - b.date.seconds);

        return events;
    } catch (error) {
        console.error("Error fetching awards events:", error);
        return [];
    }
};

// 2. Seeding Logic (Run once)
export const seedAwardsData = async () => {

    const SCHEDULE = [

        { id: '2026_critics_choice', name: "Critics' Choice Awards", date: "2026-01-04" },
        { id: '2026_golden_globes', name: "Golden Globe Awards", date: "2026-01-11" },
        { id: '2026_european', name: "European Film Awards", date: "2026-01-17" },
        { id: '2026_dga', name: "Directors Guild of America Awards (DGA)", date: "2026-02-07" },
        { id: '2026_ifta', name: "IFTA Awards Ceremony", date: "2026-02-20" },
        { id: '2026_bafta', name: "British Academy Film Awards (BAFTA)", date: "2026-02-22" },
        { id: '2026_pga', name: "Producers Guild of America Awards (PGA)", date: "2026-02-28" },
        { id: '2026_sag', name: "The Actor Awards", date: "2026-03-01" },
        { id: '2026_wga', name: "Writers Guild of America Awards (WGA)", date: "2026-03-08" },
        { id: '2026_oscars', name: "Academy Awards (Oscars)", date: "2026-03-15" }
    ];

    try {
        for (const event of SCHEDULE) {
            // Build Categories (simplified for now - applying same categories to all)
            // In future, DGA only has Directing, SAG only has Acting, etc.
            // For now, we seed 'All' so UI looks full.
            let categories = [];

            // Logic to customize slightly could go here, e.g.:
            // if (event.id.includes('dga')) categories = [directing_only];

            categories = [
                { id: 'leading_actor', name: "Best Leading Actor", awardsRatingKey: "Leading Actor", nominees: [] },
                { id: 'leading_actress', name: "Best Leading Actress", awardsRatingKey: "Leading Actress", nominees: [] },
                { id: 'directing', name: "Best Director", awardsRatingKey: "Directing", nominees: [] },
                { id: 'cinematography', name: "Best Cinematography", awardsRatingKey: "Cinematography", nominees: [] },
                { id: 'visual_effects', name: "Best Visual Effects", awardsRatingKey: "Visual Effects", nominees: [] }
            ];

            const eventData = {
                name: event.name,
                date: new Date(event.date),
                isActive: true,
                categories: categories
            };

            await setDoc(doc(db, EVENTS_COLLECTION, event.id), eventData);
        }
        console.log("Full 2026 Schedule Seeded!");
        return "Seeding Complete";
    } catch (e) {
        console.error("Seeding Failed", e);
        throw e;
    }
};

// 3. Admin: Add Nominee to Category
export const addNomineeToCategory = async (eventId, categoryId, nominee) => {
    try {
        const eventRef = doc(db, EVENTS_COLLECTION, eventId);
        const eventSnap = await import('firebase/firestore').then(mod => mod.getDoc(eventRef));
        const eventDocData = eventSnap.data();

        if (!eventDocData) throw new Error("Event not found");

        const updatedCategories = eventDocData.categories.map(cat => {
            if (cat.id === categoryId) {
                if (cat.nominees.some(n => n.tmdbId === nominee.tmdbId)) return cat;
                return { ...cat, nominees: [...cat.nominees, nominee] };
            }
            return cat;
        });

        await import('firebase/firestore').then(mod => mod.updateDoc(eventRef, { categories: updatedCategories }));
        return true;
    } catch (error) {
        console.error("Error adding nominee:", error);
        throw error;
    }
};

// 4. Admin: Remove Nominee
export const removeNomineeFromCategory = async (eventId, categoryId, nomineeId) => {
    try {
        const eventRef = doc(db, EVENTS_COLLECTION, eventId);
        const eventSnap = await import('firebase/firestore').then(mod => mod.getDoc(eventRef));
        const eventDocData = eventSnap.data();

        if (!eventDocData) throw new Error("Event not found");

        const updatedCategories = eventDocData.categories.map(cat => {
            if (cat.id === categoryId) {
                return { ...cat, nominees: cat.nominees.filter(n => n.tmdbId !== nomineeId) };
            }
            return cat;
        });

        await import('firebase/firestore').then(mod => mod.updateDoc(eventRef, { categories: updatedCategories }));
        return true;
    } catch (error) {
        console.error("Error removing nominee:", error);
        throw error;
    }
};

// 5. Admin: Add Category
export const addCategoryToEvent = async (eventId, category) => {
    try {
        const eventRef = doc(db, EVENTS_COLLECTION, eventId);
        const eventSnap = await import('firebase/firestore').then(mod => mod.getDoc(eventRef));
        const eventDocData = eventSnap.data();

        if (!eventDocData) throw new Error("Event not found");

        if (eventDocData.categories.some(c => c.id === category.id)) {
            throw new Error("Category already exists");
        }

        const updatedCategories = [...eventDocData.categories, category];

        await import('firebase/firestore').then(mod => mod.updateDoc(eventRef, { categories: updatedCategories }));
        return true;
    } catch (error) {
        console.error("Error adding category:", error);
        throw error;
    }
};

// 6. Admin: Remove Category
export const removeCategoryFromEvent = async (eventId, categoryId) => {
    try {
        const eventRef = doc(db, EVENTS_COLLECTION, eventId);
        const eventSnap = await import('firebase/firestore').then(mod => mod.getDoc(eventRef));
        const eventDocData = eventSnap.data();

        if (!eventDocData) throw new Error("Event not found");

        const updatedCategories = eventDocData.categories.filter(c => c.id !== categoryId);

        await import('firebase/firestore').then(mod => mod.updateDoc(eventRef, { categories: updatedCategories }));
        return true;
    } catch (error) {
        console.error("Error removing category:", error);
        throw error;
    }
};

// 7. User: Save Ballot Pick
export const saveUserPick = async (userId, eventId, categoryId, nomineeId) => {
    try {
        const ballotRef = doc(db, "users", userId, "awards_ballots", eventId);
        // Merge true so we don't overwrite other category picks
        await setDoc(ballotRef, { [categoryId]: nomineeId }, { merge: true });
        return true;
    } catch (error) {
        console.error("Error saving pick:", error);
        throw error;
    }
};

// 8. User: Fetch Ballot
export const fetchUserBallot = async (userId, eventId) => {
    try {
        const ballotRef = doc(db, "users", userId, "awards_ballots", eventId);
        const snap = await import('firebase/firestore').then(mod => mod.getDoc(ballotRef));
        if (snap.exists()) return snap.data();
        return {};
    } catch (error) {
        console.error("Error fetching ballot:", error);
        return {};
    }
};

// 9. Admin: Mark Category Winner
export const markCategoryWinner = async (eventId, categoryId, nomineeTmdbId) => {
    try {
        const eventRef = doc(db, EVENTS_COLLECTION, eventId);
        const eventSnap = await import('firebase/firestore').then(mod => mod.getDoc(eventRef));
        const eventDocData = eventSnap.data();

        if (!eventDocData) throw new Error("Event not found");

        const updatedCategories = eventDocData.categories.map(cat => {
            if (cat.id === categoryId) {
                // Toggle logic: if already winner, unset it? Or just set new one. 
                // Let's allow unsetting if passing null, or toggle. 
                // For now, simple set.
                return { ...cat, winnerTmdbId: nomineeTmdbId };
            }
            return cat;
        });

        await import('firebase/firestore').then(mod => mod.updateDoc(eventRef, { categories: updatedCategories }));
        return true;
    } catch (error) {
        console.error("Error setting winner:", error);
        throw error;
    }
};
// 10. Admin: Update Event (Date, Lock Status)
export const updateEvent = async (eventId, updates) => {
    try {
        const eventRef = doc(db, EVENTS_COLLECTION, eventId);
        await import('firebase/firestore').then(mod => mod.updateDoc(eventRef, updates));
        return true;
    } catch (error) {
        console.error("Error updating event:", error);
        throw error;
    }
};
// 12. Admin: Update Nominee (e.g. Name/Description)
export const updateNominee = async (eventId, categoryId, nomineeId, updates) => {
    try {
        const eventRef = doc(db, EVENTS_COLLECTION, eventId);
        const eventSnap = await import('firebase/firestore').then(mod => mod.getDoc(eventRef));
        const eventDocData = eventSnap.data();

        if (!eventDocData) throw new Error("Event not found");

        const updatedCategories = eventDocData.categories.map(cat => {
            if (cat.id === categoryId) {
                const updatedNominees = cat.nominees.map(n => {
                    if (n.tmdbId === nomineeId) {
                        return { ...n, ...updates };
                    }
                    return n;
                });
                return { ...cat, nominees: updatedNominees };
            }
            return cat;
        });

        await import('firebase/firestore').then(mod => mod.updateDoc(eventRef, { categories: updatedCategories }));
        return true;
    } catch (error) {
        console.error("Error updating nominee:", error);
        throw error;
    }
};

// 11. Admin: Delete Event
export const deleteEvent = async (eventId) => {
    try {
        await import('firebase/firestore').then(mod => mod.deleteDoc(doc(db, EVENTS_COLLECTION, eventId)));
        return true;
    } catch (error) {
        console.error("Error deleting event:", error);
        throw error;
    }
};
// 13. Admin: Reorder Categories
export const reorderCategories = async (eventId, newCategoriesList) => {
    try {
        const eventRef = doc(db, EVENTS_COLLECTION, eventId);
        await import('firebase/firestore').then(mod => mod.updateDoc(eventRef, { categories: newCategoriesList }));
        return true;
    } catch (error) {
        console.error("Error reordering categories:", error);
        throw error;
    }
};
