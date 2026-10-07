import os
import random
import pickle
import json
from datetime import datetime

import pandas as pd
import numpy as np

import xgboost as xgb
from imblearn.over_sampling import SMOTE
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report,
)

# Reproducibility
seed = 42
os.environ["PYTHONHASHSEED"] = str(seed)
np.random.seed(seed)
random.seed(seed)

print("[OK] Loading preprocessed data...")
df = pd.read_csv("data/processed_parking.csv")
print("Dataset shape:", df.shape)

# Features / target
X = df.drop("availability", axis=1)
y = df["availability"]

# Persist feature order for the Flask API
feature_order = list(X.columns)
with open("feature_order.pkl", "wb") as f:
    pickle.dump(feature_order, f)
print("Feature order saved:", feature_order)

# Encode categorical columns
encoders = {}
for col in X.select_dtypes(include=["object"]).columns:
    le = LabelEncoder()
    X[col] = le.fit_transform(X[col])
    encoders[col] = le

# Show class distribution before SMOTE
print("Class distribution before SMOTE:")
print(y.value_counts().to_dict())

# Stratified train/test split to prevent leakage
stratify = y if y.nunique() > 1 else None
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=seed, stratify=stratify
)

# Apply SMOTE to the training set ONLY to handle class imbalance (prevents data leakage)
print("Applying SMOTE to training partition...")
smote = SMOTE(random_state=seed)
X_train_res, y_train_res = smote.fit_resample(X_train, y_train)
print("Class distribution after SMOTE (training set):")
print(pd.Series(y_train_res).value_counts().to_dict())

# Scale features (XGBoost doesn't strictly need it, but Flask prediction API scales inputs, so we fit the scaler)
scaler = StandardScaler()
X_train_res_scaled_arr = scaler.fit_transform(X_train_res)
X_test_scaled_arr = scaler.transform(X_test)

# Retain DataFrame structures for scikit-learn and XGBoost feature naming support
X_train_res_scaled = pd.DataFrame(X_train_res_scaled_arr, columns=X_train_res.columns)
X_test_scaled = pd.DataFrame(X_test_scaled_arr, columns=X_test.columns)

# Set up GridSearchCV for hyperparameter tuning
print("Setting up GridSearchCV for XGBoost classifier...")
xgb_clf = xgb.XGBClassifier(
    use_label_encoder=False,
    eval_metric="logloss",
    random_state=seed
)

# Fast but comprehensive search grid
param_grid = {
    "max_depth": [3, 5, 7],
    "learning_rate": [0.01, 0.05, 0.1, 0.2],
    "n_estimators": [100, 200, 300],
    "subsample": [0.8, 1.0],
    "colsample_bytree": [0.8, 1.0]
}

grid_search = GridSearchCV(
    estimator=xgb_clf,
    param_grid=param_grid,
    cv=3,
    scoring="f1",
    n_jobs=-1,
    verbose=1
)

print("Starting grid search hyperparameter tuning...")
grid_search.fit(X_train_res_scaled, y_train_res)
print("Grid search completed.")
print("Best parameters found:", grid_search.best_params_)
print("Best F1 score from cross-validation: {:.2f}%".format(grid_search.best_score_ * 100))

# Get the best trained XGBoost model
best_model = grid_search.best_estimator_

# Evaluate on the unseen test set
y_pred = best_model.predict(X_test_scaled)
y_prob = best_model.predict_proba(X_test_scaled)[:, 1]

acc = accuracy_score(y_test, y_pred)
prec = precision_score(y_test, y_pred, zero_division=0)
rec = recall_score(y_test, y_pred, zero_division=0)
f1 = f1_score(y_test, y_pred, zero_division=0)
auc = roc_auc_score(y_test, y_prob) if y_test.nunique() > 1 else 1.0

print("\n=== MODEL PERFORMANCE EVALUATION ===")
print("Accuracy:  {:.2f}%".format(acc * 100))
print("Precision: {:.2f}%".format(prec * 100))
print("Recall:    {:.2f}%".format(rec * 100))
print("F1 Score:  {:.2f}%".format(f1 * 100))
print("ROC AUC:   {:.2f}%".format(auc * 100))
print("\nConfusion Matrix:\n", confusion_matrix(y_test, y_pred))
print("\nClassification Report:\n", classification_report(y_test, y_pred, zero_division=0))

# Save artifacts
with open("scaler.pkl", "wb") as f:
    pickle.dump(scaler, f)
with open("encoders.pkl", "wb") as f:
    pickle.dump(encoders, f)
with open("parking_model.pkl", "wb") as f:
    pickle.dump(best_model, f)

# Remove legacy H5 Keras NN file if exists to prevent model loading conflicts in app.py
if os.path.exists("parking_model.h5"):
    os.remove("parking_model.h5")
    print("Cleaned up legacy parking_model.h5")

print("Saved: parking_model.pkl, scaler.pkl, encoders.pkl")

# Save evaluation metrics to JSON for Flask API dashboard
metrics_dict = {
    "model_type": "XGBoost",
    "accuracy": float(acc),
    "precision": float(prec),
    "recall": float(rec),
    "f1_score": float(f1),
    "last_trained": datetime.utcnow().isoformat() + "Z"
}
with open("model_metrics.json", "w") as f:
    json.dump(metrics_dict, f, indent=2)
print("Saved evaluation metrics to model_metrics.json")
print("Done")
