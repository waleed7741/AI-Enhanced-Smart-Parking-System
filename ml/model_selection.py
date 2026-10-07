import os
import pickle
import numpy as np
import pandas as pd
import json
from datetime import datetime

from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
from imblearn.over_sampling import SMOTE

try:
    import xgboost as xgb
    has_xgb = True
except Exception:
    has_xgb = False

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense
from tensorflow.keras.callbacks import EarlyStopping

RANDOM_STATE = 42
np.random.seed(RANDOM_STATE)

print('Loading data...')
df = pd.read_csv('data/processed_parking.csv')
X = df.drop('availability', axis=1).copy()
y = df['availability'].copy()

# Persist feature order for the Flask API
feature_order = list(X.columns)
with open('feature_order.pkl', 'wb') as f:
    pickle.dump(feature_order, f)
print("Feature order saved:", feature_order)

categorical_cols = X.select_dtypes(include=['object']).columns.tolist()
encoders = {}
for col in categorical_cols:
    le = LabelEncoder()
    X[col] = le.fit_transform(X[col].astype(str))
    encoders[col] = le

# Stratified train/test split to prevent leakage
X_train_raw, X_test_raw, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
)

# Apply SMOTE to the training set ONLY to handle class imbalance
print('Applying SMOTE to training partition...')
smote = SMOTE(random_state=RANDOM_STATE)
X_train_res, y_train_res = smote.fit_resample(X_train_raw, y_train)
print('Class counts after SMOTE (training set):', pd.Series(y_train_res).value_counts().to_dict())

# Scale features based on SMOTE-balanced training set
scaler = StandardScaler()
X_train_arr = scaler.fit_transform(X_train_res)
X_test_arr = scaler.transform(X_test_raw)

# Retain DataFrame structures to enable feature_names_in_ on all classifiers
X_train = pd.DataFrame(X_train_arr, columns=X_train_res.columns)
X_test = pd.DataFrame(X_test_arr, columns=X_test_raw.columns)

results = []

# Logistic Regression
print('Training LogisticRegression...')
clf_lr = LogisticRegression(solver='liblinear', random_state=RANDOM_STATE)
clf_lr.fit(X_train, y_train_res)
yp = clf_lr.predict(X_test)
yp_prob = clf_lr.predict_proba(X_test)[:,1]
results.append(('LogisticRegression', clf_lr, yp, yp_prob))

# Random Forest
print('Training RandomForestClassifier...')
clf_rf = RandomForestClassifier(n_estimators=200, random_state=RANDOM_STATE)
clf_rf.fit(X_train, y_train_res)
yp = clf_rf.predict(X_test)
yp_prob = clf_rf.predict_proba(X_test)[:,1]
results.append(('RandomForest', clf_rf, yp, yp_prob))

# XGBoost with GridSearchCV hyperparameter tuning
if has_xgb:
    print('Training XGBoost with GridSearchCV...')
    xgb_clf = xgb.XGBClassifier(
        use_label_encoder=False, 
        eval_metric='logloss', 
        random_state=RANDOM_STATE
    )
    
    # Fast but robust grid for retrain API performance
    param_grid = {
        'max_depth': [3, 5, 7],
        'learning_rate': [0.05, 0.1, 0.15],
        'n_estimators': [100, 200],
        'subsample': [0.8, 1.0]
    }
    
    grid_search = GridSearchCV(
        estimator=xgb_clf,
        param_grid=param_grid,
        cv=3,
        scoring='f1',
        n_jobs=-1,
        verbose=0
    )
    grid_search.fit(X_train, y_train_res)
    
    best_xgb = grid_search.best_estimator_
    print("Best XGBoost params:", grid_search.best_params_)
    
    yp = best_xgb.predict(X_test)
    yp_prob = best_xgb.predict_proba(X_test)[:,1]
    results.append(('XGBoost', best_xgb, yp, yp_prob))
else:
    print('XGBoost not installed, skipping')

# Simple Keras NN
print('Training Keras NN...')
model = Sequential([
    Dense(64, activation='relu', input_shape=(X_train.shape[1],)),
    Dense(32, activation='relu'),
    Dense(1, activation='sigmoid')
])
model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
cb = [EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True)]
model.fit(X_train, y_train_res, validation_split=0.1, epochs=100, batch_size=32, callbacks=cb, verbose=0)
yp_prob = model.predict(X_test, verbose=0).ravel()
yp = (yp_prob > 0.5).astype(int)
results.append(('KerasNN', model, yp, yp_prob))

# Evaluate
def metrics(y_true, y_pred, y_prob):
    acc = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    roc = roc_auc_score(y_true, y_prob) if len(np.unique(y_true)) > 1 else None
    cm = confusion_matrix(y_true, y_pred)
    return dict(accuracy=acc, precision=prec, recall=rec, f1=f1, roc_auc=roc, confusion_matrix=cm)

scores = []
for name, model_obj, yp, yp_prob in results:
    m = metrics(y_test, yp, yp_prob)
    scores.append((name, model_obj, m))
    print(f"\nModel: {name}")
    print(m)

# Choose best model by F1 Score, tie-break by ROC AUC
best = sorted(scores, key=lambda x: (x[2]['f1'], x[2]['roc_auc'] or 0), reverse=True)[0]
print('\nBest model:', best[0], 'with metrics:', best[2])

# Save artifacts
print('Saving artifacts...')
with open('scaler.pkl', 'wb') as f:
    pickle.dump(scaler, f)
with open('encoders.pkl', 'wb') as f:
    pickle.dump(encoders, f)

best_name, best_model, best_metrics = best
if best_name == 'KerasNN':
    best_model.save('parking_model.h5')
    # remove sklearn pickle if present
    if os.path.exists('parking_model.pkl'):
        os.remove('parking_model.pkl')
else:
    with open('parking_model.pkl', 'wb') as f:
        pickle.dump(best_model, f)
    # remove keras model if present
    if os.path.exists('parking_model.h5'):
        os.remove('parking_model.h5')

print('Saved best model as', 'parking_model.h5' if best_name=='KerasNN' else 'parking_model.pkl')

# Save evaluation metrics to JSON for Flask API dashboard
best_metrics_dict = {
    "model_type": str(best_name),
    "accuracy": float(best_metrics['accuracy']),
    "precision": float(best_metrics['precision']),
    "recall": float(best_metrics['recall']),
    "f1_score": float(best_metrics['f1']),
    "last_trained": datetime.utcnow().isoformat() + "Z"
}
with open('model_metrics.json', 'w') as f:
    json.dump(best_metrics_dict, f, indent=2)
print("Saved evaluation metrics to model_metrics.json")

print('Done')
