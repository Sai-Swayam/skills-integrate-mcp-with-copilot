from copy import deepcopy

from fastapi.testclient import TestClient

from src.app import activities, app, sessions


client = TestClient(app)


def login_as(username: str, password: str) -> str:
    response = client.post(
        "/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def setup_function() -> None:
    sessions.clear()
    setup_function.activities_snapshot = deepcopy(activities)


def teardown_function() -> None:
    sessions.clear()
    activities.clear()
    activities.update(deepcopy(setup_function.activities_snapshot))


def test_login_success_and_profile() -> None:
    response = client.post(
        "/auth/login",
        json={"username": "admin", "password": "admin123"},
    )

    assert response.status_code == 200
    body = response.json()
    token = body["access_token"]
    assert body["user"]["role"] == "Administrator"

    me_response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["username"] == "admin"


def test_login_failure_rejected() -> None:
    response = client.post(
        "/auth/login",
        json={"username": "admin", "password": "wrong-password"},
    )
    assert response.status_code == 401


def test_signup_requires_authentication() -> None:
    response = client.post("/activities/Chess%20Club/signup?email=tester@mergington.edu")
    assert response.status_code == 401


def test_student_cannot_signup_or_unregister() -> None:
    student_token = login_as("student1", "student123")
    headers = {"Authorization": f"Bearer {student_token}"}

    signup_response = client.post(
        "/activities/Chess%20Club/signup?email=student-blocked@mergington.edu",
        headers=headers,
    )
    assert signup_response.status_code == 403

    unregister_response = client.delete(
        "/activities/Chess%20Club/unregister?email=michael@mergington.edu",
        headers=headers,
    )
    assert unregister_response.status_code == 403


def test_faculty_can_signup_and_unregister() -> None:
    faculty_token = login_as("faculty1", "faculty123")
    headers = {"Authorization": f"Bearer {faculty_token}"}
    email = "new.student@mergington.edu"

    signup_response = client.post(
        f"/activities/Chess%20Club/signup?email={email}",
        headers=headers,
    )
    assert signup_response.status_code == 200

    unregister_response = client.delete(
        f"/activities/Chess%20Club/unregister?email={email}",
        headers=headers,
    )
    assert unregister_response.status_code == 200
