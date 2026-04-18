import "../index.css";

import { Component, type ChangeEvent, type FormEvent } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

interface LoginProps {
  goToSignUp: () => void;
}

export default class Login extends Component<LoginProps> {
  state = { email: "", password: "" };

  handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({ [e.target.type]: e.target.value });
  };

  handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(
        auth,
        this.state.email,
        this.state.password,
      );
      alert("Success! Welcome back to EcoPulse.");
      window.location.href = "/dashboard";
    } catch (error: any) {
      alert("Login failed: " + error.message);
    }
  };

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <h3>Login</h3>
        <div className="mb-3">
          <label>Email address</label>
          <input
            type="email"
            className="form-control"
            placeholder="Enter email"
            onChange={this.handleChange}
            required
          />
        </div>
        <div className="mb-3">
          <label>Password</label>
          <input
            type="password"
            className="form-control"
            placeholder="Enter password"
            onChange={this.handleChange}
            required
          />
        </div>
        <div className="d-grid">
          <button type="submit" className="btn btn-secondary">
            Submit
          </button>
        </div>
        <p className="forgot-password text-right">
          Forgot <a href="#">password?</a>
        </p>
        <p className="forgot-password text-right mt-2">
          New user?{" "}
          <button
            type="button"
            className="btn btn-link p-0"
            onClick={this.props.goToSignUp}
          >
            Sign up
          </button>
        </p>
      </form>
    );
  }
}

// export default class Login extends Component<LoginProps> {
//   render() {
//     return (
//       <form>
//         <h3>Login</h3>
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
//         <div className="mb-3">
//           <div className="custom-control custom-checkbox">
//             <input
//               type="checkbox"
//               className="custom-control-input"
//               id="customCheck1"
//             />
//             <label className="custom-control-label" htmlFor="customCheck1">
//               Remember me
//             </label>
//           </div>
//         </div>
//         <div className="d-grid">
//           <button type="submit" className="btn btn-secondary">
//             Submit
//           </button>
//         </div>
//         <p className="forgot-password text-right">
//           Forgot <a href="#">password?</a>
//         </p>
//         <p className="forgot-password text-right mt-2">
//           New user?{" "}
//           <button
//             type="button"
//             className="btn btn-link p-0"
//             onClick={this.props.goToSignUp}
//           >
//             Sign up
//           </button>
//         </p>
//       </form>
//     );
//   }
// }
