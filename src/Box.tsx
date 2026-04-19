import { useState } from "react";
import { db, auth } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import "./Box.css";

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
    <div className="container bg-white p-5 rounded shadow-sm text-center">
      <h1 className="mb-4">
        After evaluating, if you decide to purchase, add it to the list below
      </h1>
      <div className="d-flex flex-column align-items-center">
        <input
          type="text"
          className="form-control w-50 mb-3"
          placeholder="Type in the name of the item"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button className="btn btn-success px-4" onClick={handleLog}>
          Log
        </button>
      </div>
    </div>
  );
};

export default Box;
