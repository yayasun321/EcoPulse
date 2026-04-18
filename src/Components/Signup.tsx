import "../index.css";

import { Component, type ChangeEvent, type FormEvent } from "react";
import { auth } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";

interface SignUpProps {
  goToLogin: () => void;
}

export default class SignUp extends Component<SignUpProps> {
  state = { email: "", password: "" };

  handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({ [e.target.type]: e.target.value });
  };

  handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(
        auth,
        this.state.email,
        this.state.password,
      );
      alert("Account created successfully!");
      this.props.goToLogin();
    } catch (error: any) {
      alert("Error: " + error.message);
    }
  };

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <h3>Sign Up</h3>
        <div className="mb-3">
          <label>Email address</label>
          <input
            type="email"
            className="form-control"
            onChange={this.handleChange}
            required
          />
        </div>
        <div className="mb-3">
          <label>Password</label>
          <input
            type="password"
            className="form-control"
            onChange={this.handleChange}
            required
          />
        </div>
        <div className="d-grid">
          <button type="submit" className="btn btn-secondary">
            Sign Up
          </button>
        </div>
        <p className="forgot-password text-right mt-2">
          Already registered?{" "}
          <button
            type="button"
            className="btn btn-link p-0"
            onClick={this.props.goToLogin}
          >
            Log in
          </button>
        </p>
      </form>
    );
  }
}

// interface SignUpProps {
//   goToLogin: () => void;
// }

// export default class SignUp extends Component<SignUpProps> {
//   render() {
//     return (
//       <form>
//         <h3>Sign Up</h3>
//         <div className="mb-3">
//           <label>First name</label>
//           <input
//             type="text"
//             className="form-control"
//             placeholder="First name"
//           />
//         </div>
//         <div className="mb-3">
//           <label>Last name</label>
//           <input type="text" className="form-control" placeholder="Last name" />
//         </div>
//         <div className="mb-3">
//           <label>Email address</label>
//           <input
//             type="email"
//             className="form-control"
//             placeholder="Enter email"
//           />
//         </div>
//         <div className="mb-3">
//           <label>Password</label>
//           <input
//             type="password"
//             className="form-control"
//             placeholder="Enter password"
//           />
//         </div>
//         <div className="d-grid">
//           <button type="submit" className="btn btn-secondary">
//             Sign Up
//           </button>
//         </div>
//         <p className="forgot-password text-right mt-2">
//           Already registered?{" "}
//           <button
//             type="button"
//             className="btn btn-link p-0"
//             onClick={this.props.goToLogin}
//           >
//             Log in
//           </button>
//         </p>
//       </form>
//     );
//   }
// }
