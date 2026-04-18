import React, { useState, useEffect } from "react";
import {
  Timestamp,
  collection,
  query,
  onSnapshot,
  orderBy,
  where,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "./src/firebase";
import Box from "./src/Box";
import Button from "./src/Button";
import Carousel from "./src/Components/MyCarousel";
import "../node_modules/bootstrap/dist/css/bootstrap.min.css";
import "./Button.css";

interface Purchase {
  id: string;
  item: string;
  createdAt: Timestamp;
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setPurchases([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "purchases"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
    );

    const unsubscribeData = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as { item: string; createdAt: Timestamp }),
        }));
        setPurchases(items);
      },
      (error) => {
        console.error("Firestore error:", error);
      },
    );

    return () => unsubscribeData();
  }, [user]);

  if (!user) {
    return <Carousel />;
  }

  return (
    <div className="container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="Main-Title">Want to buy an item?</h1>
        <button
          className="btn btn-outline-danger btn-sm"
          onClick={() => signOut(auth)}
        >
          Logout
        </button>
      </div>

      <Button onClick={() => console.log("Evaluate clicked")}>Evaluate</Button>
      <Box />

      <h1 className="Purchased-Title mt-5">Purchased:</h1>
      <ul className="list-group mb-5">
        {purchases.map((p) => (
          <li
            key={p.id}
            className="list-group-item d-flex justify-content-between align-items-center"
          >
            <span className="fw-bold">{p.item}</span>
            <span className="text-muted small">
              {p.createdAt
                ? p.createdAt.toDate().toLocaleDateString()
                : "Pending..."}
            </span>
          </li>
        ))}
        {purchases.length === 0 && (
          <li className="list-group-item text-center text-muted">
            No purchases logged yet.
          </li>
        )}
      </ul>
    </div>
  );
}

export default App;
