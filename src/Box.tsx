import { useState } from "react";
import { db, auth } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import "./Box.css";
import "./Button.css";
import Button from "./Button.tsx";

const Box = () => {
  const [inputValue, setInputValue] = useState("");
  const handleLog = async () => {
    if (inputValue === "") console.log("User bought:", inputValue);
    try {
      await addDoc(collection(db, "purchases"), {
        item: inputValue,
        createdAt: serverTimestamp(),
        userId: auth.currentUser?.uid,
      });

      console.log("Document written to Firebase");
      setInputValue("");
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };

  return (
    <div className="login-box">
      <input
        type="text"
        placeholder="Type in the name of the item"
        className="purchase-input"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      <Button onClick={handleLog}>Log</Button>
    </div>
  );
};

export default Box;
