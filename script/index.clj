(ns index
  (:require [babashka.http-client :as http]
            [cheshire.core :as json]))

(def batch-size 25)

(def d1-api-key (System/getenv "D1_API_KEY"))
(def d1-account (System/getenv "D1_ACCOUNT"))
(def d1-database-id (System/getenv "D1_DATABASE_ID"))

(def d1-url
  (str "https://api.cloudflare.com/client/v4/accounts/" d1-account  "/d1/database/" d1-database-id  "/query"))

(defn send-d1-query
  [url api-key request]
  (http/post url
             {:headers
              {:content-type "application/json" :authorization (str "Bearer " api-key)}
              :body (json/encode request)}))
(defn build-recipe-request
  [recipe]
  {:recipeId (:id recipe)
   :issue (:number recipe)
   :months (str (:startMonth recipe) "-" (:endMonth recipe))
   :year (:year recipe)
   :mainTitle (:titleBackCover recipe)
   :coverTitle (:titleFrontCover recipe)
   :categories [(:name recipe)]
   :page (:page recipe)
   :notes nil})


(defn get-recipes
  []
  (let [req {:sql "SELECT r.id,r.titleFrontCover,r.titleBackCover,r.page,r.notes,i.number, i.startMonth, i.endMonth,i.year, c.name FROM recipe r INNER JOIN issue i ON r.issueId = i.id INNER JOIN category c ON r.categoryId = c.id" :parameters []}]
    (->
      (send-d1-query d1-url d1-api-key req)
      (:body)
      (json/parse-string  true)
      (:result)
      (first)
      (:results)
      (as-> requests (map build-recipe-request requests)))))

(def index-settings {:host (System/getenv "SEARCH_HOST")
                     :recipe-index (System/getenv "SEARCH_INDEX")
                     :key (System/getenv "SEARCH_ADMIN_API_KEY")})

(defn update-index
  [recipes]
  (let [req (json/encode recipes)
        {host :host index :recipe-index key :key} index-settings]
    (-> (http/put (str host "/indexes/" index "/documents")
              {:headers {:content-type "application/json"
                              :authorization (str "Bearer " key)}
                    :body req})
        (get :status))))

(defn apply-updates
  [coll fn]
  (doseq [coll-block (partition-all batch-size coll)]
    (println(fn coll-block))))

(defn -main
  [& _args]
  (apply-updates (get-recipes) update-index))
