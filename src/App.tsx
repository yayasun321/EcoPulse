import { useState, useEffect } from "react";
import {
  Timestamp,
  collection,
  query,
  onSnapshot,
  orderBy,
  where,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "./firebase";
import Box from "./Box";
import Button from "./Button";
import Carousel from "./Components/MyCarousel";
import "../node_modules/bootstrap/dist/css/bootstrap.min.css";
import AppAntara from "./AppAntara";

interface Purchase {
  id: string;
  item: string;
  createdAt: Timestamp;
}

function App() {
  const [showEvaluation, setShowEvaluation] = useState(false);
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

  if (showEvaluation) {
    return <AppAntara />;
  }

  return (
    <div className="container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="Main-Title">Want to buy an item?</h2>
        <button
          className="btn btn-outline-danger btn-sm"
          onClick={() => signOut(auth)}
        >
          Logout
        </button>
      </div>

      <div className="text-center">
        <Button onClick={() => setShowEvaluation(true)}>Evaluate</Button>
        <div className="mt-3">
          <Box />
        </div>
      </div>

      <h1 className="Purchased-Title mt-5">Previous Purchases:</h1>
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
